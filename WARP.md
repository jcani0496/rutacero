# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Install & run the app locally

- Install dependencies (from the project root):

```bash
npm install
```

- Start the Next.js development server on http://localhost:3000:

```bash
npm run dev
```

> You can also use other package managers (yarn, pnpm, bun) if preferred, using their standard equivalents of the `dev` script as shown in `README.md`.

### Build & run in production mode

- Create a production build:

```bash
npm run build
```

- Start the production server (after `npm run build`):

```bash
npm start
```

### Linting

- Run ESLint over the project:

```bash
npm run lint
```

### Environment configuration

- Copy `.env.example` into a new `.env.local` file at the project root.
- Stack: Railway Postgres + better-auth + Railway Buckets (see `.env.example`):
  - `DATABASE_URL`, `BETTER_AUTH_SECRET`
  - `AUTH_PROVIDER` / `DATA_PROVIDER` / `STORAGE_PROVIDER` (`better-auth` / `drizzle` / `railway`)
  - App base URL: `NEXT_PUBLIC_APP_URL`
  - Recurrente: `RECURRENTE_*`
  - Resend: `RESEND_API_KEY`
  - Cron: `CRON_SECRET` (GitHub Actions → Railway endpoints)
- Do not set `SUPABASE_*` or Vercel project linkage.

### Tests

- Unit: `npm run test:run` (Vitest). E2E: `npm run test:e2e:login` (Postgres + better-auth).

### Local DB / schema

- Local Postgres: `docker compose -f docker-compose.db.yml` (`npm run db:up:local`).
- Schema via Drizzle (`src/db/schema/`, `npm run db:push:local`).
- Historical Supabase SQL only in `archive/supabase/` (do not re-wire).

## Architecture Overview

### High-level stack

- Next.js App Router (TypeScript) under `src/app`, deployed on Railway (`railway.json`).
- Railway Postgres + Drizzle ORM; better-auth; Railway Buckets for receipts.
- Tailwind CSS 4 and UI under `src/components/ui` (Radix + shadcn-style).
- Payments via Recurrente; email via Resend.
- Spanish-language debt planning for Guatemalan users (`es_GT`, `GTQ`/`USD`).

### Next.js app structure (routing & layouts)

- Global layout: `src/app/layout.tsx`
  - Sets up fonts (Inter + Geist Mono), global metadata (Spanish SEO, `es_GT` locale), theme color, and wraps the app with a global `<Toaster />`.
  - Uses `NEXT_PUBLIC_APP_URL` to build `metadataBase` for OpenGraph and social sharing URLs.

- Route groups in `src/app`:
  - `(public)` – Marketing / landing experience at `/`:
    - `src/app/(public)/page.tsx` composes the public site from `src/components/landing/*` (hero, features, how-it-works, pricing preview, FAQ, CTA, footer).
  - `(auth)` – Authentication & onboarding flows:
    - `src/app/(auth)/layout.tsx` defines a two-panel auth layout (branding artwork + form container) and sets auth-specific metadata.
    - Pages: `login`, `signup`, `forgot-password`, `reset-password`, `onboarding`, `auth/callback` (for Supabase OAuth callbacks).
  - `(app)` – Authenticated main user app (dashboard and tools):
    - `src/app/(app)/layout.tsx` is an async server layout that:
      - Uses `createClient` from `src/lib/supabase/server.ts` to fetch the current user.
      - Redirects unauthenticated users to `/login`.
      - Enforces onboarding completion by checking `user_profiles.onboarding_completed` and redirecting to `/onboarding` if needed.
      - Reads the current subscription from `subscriptions` to compute `planCode` and `isPro`, which are passed into layout components.
      - Renders the app chrome via `AppSidebar`, `AppHeader`, and `BottomNav` from `src/components/features` and `src/components/ui`.
    - Key child routes under `(app)` (each typically paired with a `*-client.tsx` client component):
      - `dashboard/` – Overview of debts and key analytics.
      - `debts/` – Debt management UI:
        - `page.tsx` is a server component that loads user profile (for currency), subscription (for Pro/Business gating), and the actual debts/stats via `getDebts` / `getDebtStats` from `src/lib/actions/debts.ts`, then renders `DebtsClient`.
      - `finances/`, `forecast/`, `payments/`, `plan/`, `settings/` – Follow a similar pattern: server pages calling domain-specific server actions, passing data into client components to render interactive UIs.
      - `checkout/` & `checkout/success/` – Subscription upgrade checkout flow, backed by the Recurrente API routes.
      - Static informational pages: `pricing/`, `privacy/`, `terms/`.
  - `admin` – Operator/admin console:
    - `src/app/admin/layout.tsx` wraps admin pages and conditionally renders `AdminSidebar` if `getAdminSession` (from `src/lib/actions/admin-auth.ts`) returns a session.
    - Pages include `dashboard`, `users`, `reports`, `seed`, `support`, `settings`, and `login`, with corresponding `*-client.tsx` files for interactive tables and charts.

### Auth, middleware, and route protection

- Supabase auth client:
  - `src/lib/supabase/server.ts` exports `createClient()` (RLS-aware server-side Supabase client bound to Next.js cookies) and `createAdminClient()` (service-role client used for privileged operations like webhooks and admin tasks).

- Middleware integration:
  - `src/lib/supabase/middleware.ts` defines `updateSession(request: NextRequest)` which:
    - Creates a Supabase server client bound to the incoming request cookies.
    - Calls `supabase.auth.getUser()` to refresh/validate the session.
    - Classifies routes into:
      - Auth routes: `/login`, `/signup`.
      - App routes: `/dashboard`, `/debts`, `/plan`, `/forecast`, `/finances`, `/payments`, `/settings`, `/profile`.
      - Admin routes: `/admin/**` (except `/admin/login`).
    - Protects app routes: unauthenticated users are redirected to `/login`.
    - Protects admin routes via an `admin_session` cookie: no cookie → redirect to `/admin/login`.
    - Redirects authenticated users away from auth routes back to `/dashboard`.
  - `src/middleware.ts` wires Next.js middleware to `updateSession` and uses a `matcher` to apply it to all non-static, non-asset routes.

### Domain logic & server actions (`src/lib/actions`)

- This directory contains server actions (all `'use server'`) that encapsulate database and business logic per domain. Examples:
  - `debts.ts` – CRUD for debts and summary statistics:
    - `getDebts`, `getDebtById`, `createDebt`, `updateDebt`, `deleteDebt`, `markDebtAsPaid`, `getDebtStats`.
    - Uses `createClient()` for per-user access, relies on Supabase RLS, and calls `revalidatePath` on relevant routes (`/debts`, `/dashboard`) after mutations.
    - Integrates with feature gating via `checkDebtLimit()` from `src/lib/utils/feature-access.ts`, throwing a structured `DEBT_LIMIT:current:max` error when the free-plan debt cap is reached.
  - Other notable domains (follow similar patterns):
    - `dashboard-analytics.ts`, `finances.ts`, `payments.ts`, `plan-recalculation.ts`, `plans.ts` – Debt planning, analytics, and cash-flow features.
    - `email-reminders.ts` – Logic to find upcoming payments and send reminder emails, used by the cron API route.
    - Admin actions: `admin-analytics.ts`, `admin-auth.ts`, `admin-export.ts`, `admin-notifications.ts`, `admin-reports.ts`, `admin-users.ts`, `seed-data.ts` – Power the admin console and seeding tools.

### Calculation engines (`src/lib/engine`)

- `engine.ts` – Core debt payoff engine:
  - Implements Avalanche, Snowball, and Hybrid strategies over domain `Debt` objects from `src/types/index.ts`.
  - Key exports:
    - `calculatePayoffPlan(input: PayoffInput): PayoffPlan` –
      - Validates debts and budget, computes minimum payment totals, enforces that budget ≥ total minimums.
      - Prioritizes debts via `prioritizeDebts()` using a strategy-specific scoring function.
      - Generates a month-by-month payment timeline (`PayoffStep[]`) applying minimums and extra payments to the highest-priority debt and accruing interest.
      - Returns a summary with total principal, total interest, total payments, payoff horizon (months to debt-free), etc.
    - `comparePlans(debts, monthlyBudget, currency)` – Runs all three strategies, compares total interest, and recommends the cheapest one.
  - Hybrid strategy uses configurable weights (mirroring `engine_configs` in the DB) to balance APR, balance size, due-date urgency, default risk, utilization proxy, and debt type.

- `forecast.ts` – Cash-flow forecasting engine:
  - Produces 12-month (or configurable horizon) `CashFlowForecast` objects from debts, incomes, and expenses.
  - For each month, computes income, essential and variable expenses, minimum debt payments, net cash flow, and amount available for extra payments.
  - Detects cash-flow gaps (negative months) and annotates them with severity and suggestions.
  - Includes a `generatePaymentCalendar` helper to map debts into calendar events based on `due_date` and `min_payment`.

- `risk.ts` – Debt health / risk assessment engine:
  - `calculateRiskScore(input: DebtHealthInput): RiskScore` computes a composite 0–100 score and `RiskLevel` (`HEALTHY` | `AT_RISK` | `CRITICAL`) from:
    - Debt-to-income ratio.
    - Payment burden vs. available income.
    - Proportion of high-interest debt.
    - Emergency-fund months of coverage.
    - Payment consistency (on-time vs late).
  - Returns structured factors and up to three prioritized recommendations.
  - `assessDebtHealth` offers a cheaper quick health check based on aggregate metrics.

### Feature gating & plans (`src/lib/utils/feature-access.ts`)

- Central place to determine what features a user can access based on subscription plan.
  - Plans: `FREE`, `PRO`, `BUSINESS`, each mapped to `PlanLimits` (max debts, history visibility, export capabilities, what-if simulator, multi-strategy comparison, custom tags).
  - `getUserPlan()` – Reads `subscriptions` via Supabase and returns `{ planCode, isPro, limits }`.
  - `checkDebtLimit()` – Returns current debt count, max allowed, and whether an upgrade is required; used by `createDebt`.
  - `checkFeatureAccess(feature)` – Returns `{ hasAccess, planCode, isPro }` for higher-level features like export or what-if simulations.

### API routes (`src/app/api`)

- `cron/payment-reminders/route.ts`:
  - GET and POST handlers that call `processPaymentReminders()` from `src/lib/actions/email-reminders.ts`.
  - Authenticates via a `Bearer` token in the `Authorization` header, matching `CRON_SECRET`.
  - Intended to be triggered by a scheduled job (e.g., Vercel Cron) hitting `/api/cron/payment-reminders` on a daily schedule.

- `recurrente/create-checkout/route.ts`:
  - POST handler that:
    - Validates the Supabase user session.
    - Ensures the user does not already have a non-FREE active subscription.
    - Builds a base URL from `request.headers.get('origin')` or `NEXT_PUBLIC_APP_URL`.
    - Uses `getRecurrenteClient()` to create a subscription-style checkout for the PRO plan and returns its URL/ID.

- `webhooks/recurrente/route.ts`:
  - POST handler that parses Recurrente webhook events and dispatches them to handlers using a Supabase service-role client (`SUPABASE_SERVICE_ROLE_KEY`).
  - Handles events like `checkout.completed`, `payment_intent.succeeded`, `subscription.created`, `subscription.canceled`, `payment_intent.failed` to:
    - Upsert or cancel rows in `subscriptions`.
    - Mark subscriptions as `ACTIVE`, `CANCELED` (downgrading to `FREE`), or `PAST_DUE` as appropriate.

### UI components (`src/components`)

- `ui/` – Design system primitives and wrappers around Radix components:
  - Buttons, inputs, dialogs, dropdowns, tabs, sliders, select, tooltip, alert, card, table, etc.
  - `currency-input`, `date-picker`, `animated-counter`, `bottom-nav`, `typewriter`, `sonner` (toasts) are reused across app, dashboard, and plan flows.

- `features/` – Higher-level feature components:
  - `AppSidebar`, `AppHeader` – Main app chrome used by `(app)` layout.
  - `AlertBanner`, `tag-input`, `upgrade-limit-modal`, `what-if-simulator` – Feature-focused components hooked into plan limits and analytics.

- `landing/` – Static marketing sections used by the `(public)` landing page.

- `plan/` – Visualization components for payoff plans and recalculation warnings:
  - `PlanTimeline`, `RationaleCard`, `RecalculationAlert`.

- `admin/` – Admin-only components:
  - `NotificationBell`, `TimeRangeSelector`, `analytics-charts` used throughout the admin dashboard.

### Types & Supabase schema mapping (`src/types` and `supabase/`)

- `src/types/index.ts` declares rich TypeScript models corresponding to the core tables and engine concepts:
  - `UserProfile`, `Debt`, `Payment`, `IncomeEvent`, `EssentialExpense`, `VariableBudgetTarget`.
  - `Plan`, `PlanItem`, `Forecast`, `ForecastPeriod`, `Alert`, `Subscription`.
  - Admin-facing entities (`AdminUser`, `AuditLog`) and engine configuration types (`EngineConfig`, `EngineWeights`, `EngineConstraints`).
  - Enums and discriminated unions that mirror DB check constraints (e.g., `DebtType`, `DebtStatus`, `PlanStrategy`, `SubscriptionStatus`).
- `src/types/supabase.ts` (not detailed here) provides the generated Supabase `Database` type used by Supabase clients.
- SQL migrations under `supabase/migrations` are the source of truth for the schema; when changing these tables, keep `src/types` in sync.
