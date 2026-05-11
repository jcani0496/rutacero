# RutaCero Pre-Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las brechas críticas (seguridad, regulatorio, accesibilidad, copy, UX) que separan al producto de poder publicarse al mercado guatemalteco con confianza.

**Architecture:** El plan se monta sobre la base ya construida (multi-tenant + RLS, billing dual, motor v2, Sentry, funnel propio, transferencia bancaria). Las tareas son aditivas — no reescriben el motor ni los flujos de pago — y se enfocan en (a) corregir hallazgos P0 de seguridad, (b) cumplimiento regulatorio GT, (c) WCAG 2.1 AA, (d) credibilidad del landing en español, (e) hábito real con WhatsApp + foto-comprobante. Las decisiones operativas (FEL, dominio Resend, plantillas WhatsApp) se documentan pero la decisión humana queda fuera del scope técnico.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS + Storage), Recurrente, Google Play Billing, Resend, WhatsApp Business Cloud API (free tier 1k/mes), Sentry, Pino, Capacitor 8 (Android), Vitest, Playwright. Cero proveedores nuevos pagados durante este plan.

**Restricciones del usuario:** todo lo que se implemente debe permanecer gratuito al menos para implementación. WhatsApp tier gratis cubre arranque. Eliminación de cuenta self-service es regulatoria (no opcional). Disclaimer financiero es legal-defensivo (no opcional).

**Estado base verificado:**
- Branch: `claude/amazing-rhodes-152a2a`, 31 commits sobre `origin/main` con plan de monetización completo.
- Working tree limpio.
- 238/238 unit tests verde, 8/8 E2E críticos verde, typecheck + lint clean.
- Auditoría cruzada (4 reviewers: security, a11y, UX, gaps) entregada el 2026-05-09.

---

## Fases (resumen)

| # | Fase | Tareas | Costo terceros | Días |
|---|---|---|---|---|
| A | Hardening de seguridad | T1-T5 | $0 | 1-2 |
| B | Cumplimiento regulatorio GT | T6-T9 | $0 (FEL operativo aparte) | 2-3 |
| C | Credibilidad de landing en español | T10-T15 | $0 | 3-4 |
| D | Accesibilidad WCAG 2.1 AA | T16-T22 | $0 | 5-6 |
| E | Dashboard primera ejecución | T23-T25 | $0 | 7 |
| F | WhatsApp como canal | T26-T29 | $0 (Meta free tier) | 8-10 |
| G | Cierre del ciclo de pago | T30-T32 | $0 | 11-12 |
| H | Operación y observabilidad | T33-T35 | $0 | 13 |
| I | Smoke test del funnel | T36 | $0 | 14 |

---

## File Structure

**Crear:**
- `supabase/migrations/041_billing_entitlements_rls.sql` — habilita RLS en la tabla
- `supabase/migrations/042_pending_manual_transfers.sql` — persistir referenceCode con expiración
- `supabase/migrations/043_payments_receipt_url.sql` — comprobante de pago
- `supabase/migrations/044_whatsapp_optins.sql` — consentimiento WhatsApp
- `supabase/migrations/045_plan_adherence_monthly.sql` — score de adherencia
- `src/components/legal/financial-disclaimer.tsx` — banner legal para `/plan` y `/forecast`
- `src/components/landing/trust-strip.tsx` — logos / testimonios / "por quién"
- `src/components/landing/sticky-mobile-nav.tsx` — nav superior móvil con CTA
- `src/components/dashboard/first-run-welcome.tsx` — primera ejecución
- `src/lib/whatsapp/client.ts` — wrapper Meta WhatsApp Cloud API
- `src/lib/whatsapp/templates.ts` — catálogo de plantillas aprobadas (con metadata)
- `src/app/api/whatsapp/optin/route.ts` — opt-in por usuario
- `src/app/api/cron/whatsapp-reminders/route.ts` — cron diario
- `src/lib/storage/receipts.ts` — Supabase Storage helpers para comprobantes
- `src/app/(app)/payments/[paymentId]/upload-receipt/page.tsx` — upload UI
- `src/app/(app)/settings/delete-account/page.tsx` — self-service deletion
- `src/lib/actions/account-deletion.ts` — server action
- `src/lib/observability/sentry-alerts.md` — runbook de alertas

**Modificar:**
- `package.json` — añadir `@capacitor/camera`
- `next.config.ts` — CSP nonces + redact extension
- `src/lib/logger.ts` — extender `redact.paths`
- `src/lib/recurrente/cancel-subscription/route.ts` (api) — usar admin client
- `src/lib/actions/admin-auth.ts` — flujo password rotation
- `src/components/landing/{hero,features,faq,pricing-preview,cta-section,footer}.tsx` — tildes + claims + anchors + soporte/contacto
- `src/app/(app)/pricing/page.tsx` — alinear con landing
- `src/app/(auth)/login/login-client.tsx`, `signup/page.tsx` — `<h1>` real, password ≥8, role="alert"
- `src/app/(app)/debts/components/create-debt-dialog.tsx` — `<Label htmlFor>` correcto
- `src/app/(app)/finances/finances-client.tsx` — `<form onSubmit>`, aria-label en botones-icono
- `src/components/landing/faq.tsx` — aria-expanded/controls + nuevas preguntas
- `src/components/ui/typewriter.tsx` — `useReducedMotion` + pause control
- `src/app/(app)/dashboard/page.tsx` — branch a first-run cuando no hay deudas
- `src/lib/lifecycle.ts` — añadir canal WHATSAPP
- `src/app/api/billing/manual-transfer/route.ts` — persistir reference + crypto.randomBytes
- `vercel.json` — schedules de crons (verificar)

Cada archivo nuevo tiene una responsabilidad. Archivos modificados se tocan solo donde aplica el hallazgo.

---

## Convenciones por Task

- **TDD estricto** donde aplica (server actions, helpers puros, parsers). UI puro no requiere unit test pero sí E2E o smoke.
- **Comandos exactos** para test/validate.
- **Commits frecuentes** — un commit por task (sin amend); título tipo `feat(area): ...` o `fix(area): ...`.
- **No `any`** nuevos. Usa `unknown` + zod en boundaries.
- **No tocar migrations 037-040** ni el plan engine.
- **No push** durante ejecución. El usuario decide cuándo.
- Cada task que toca DB ejecuta `npm run db:push:local` y `npx supabase gen types typescript --local > src/types/supabase.ts 2>/dev/null`.

---

## FASE A — Hardening de seguridad (Días 1-2)

### Task 1: RLS en `billing_entitlements`

**Files:**
- Create: `supabase/migrations/041_billing_entitlements_rls.sql`
- Test: `__tests__/security/billing-entitlements-rls.test.ts`

- [ ] **Step 1: Migration**

```sql
-- 041_billing_entitlements_rls.sql
ALTER TABLE public.billing_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tenant entitlements" ON public.billing_entitlements;
CREATE POLICY "Members can view tenant entitlements"
    ON public.billing_entitlements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships m
            WHERE m.tenant_id = billing_entitlements.tenant_id
              AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role manages entitlements" ON public.billing_entitlements;
CREATE POLICY "Service role manages entitlements"
    ON public.billing_entitlements FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply + verify**

```bash
npm run db:push:local
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT relrowsecurity FROM pg_class WHERE relname='billing_entitlements';"
```
Expected: `t`.

- [ ] **Step 3: RLS integration test**

Create `__tests__/security/billing-entitlements-rls.test.ts` that, using two service-role-bypassed clients impersonating two different users via `auth.uid()` set, asserts user A cannot SELECT entitlements with `tenant_id` of user B's tenant. Pattern: copy from `__tests__/security/rls-webhook.integration.test.ts` if it exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/041_billing_entitlements_rls.sql __tests__/security/billing-entitlements-rls.test.ts
git commit -m "fix(security): enable RLS on billing_entitlements"
```

### Task 2: `npm audit fix` + bump vulnerable deps

- [ ] **Step 1**: `npm audit --omit=dev` capture state.
- [ ] **Step 2**: `npm audit fix` (non-breaking). If `next` requires major bump, run `npm install next@latest` and validate `npm run build` + full vitest suite + critical E2E. If breaking changes detected (Next 16→17 etc.), STOP and report — needs human review.
- [ ] **Step 3**: Re-run audit. Expect 0 high/critical.
- [ ] **Step 4**: Add to `.github/workflows/ci.yml` a step `npm audit --omit=dev --audit-level=high` that fails on high/critical. (Read existing workflow first.)
- [ ] **Step 5**: Commit
```
git commit -m "chore(deps): update next/rollup/postcss to patch CVEs"
```

### Task 3: Sanitize errors + persist `referenceCode` in `manual-transfer`

**Files:**
- Create: `supabase/migrations/042_pending_manual_transfers.sql`
- Modify: `src/app/api/billing/manual-transfer/route.ts`
- Test: `__tests__/api/manual-transfer.test.ts` (existing — extend)

- [ ] **Step 1: Migration**

```sql
CREATE TABLE IF NOT EXISTS public.pending_manual_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    variant_code VARCHAR(32) NOT NULL,
    reference_code VARCHAR(80) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_manual_transfers_tenant
    ON public.pending_manual_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_manual_transfers_expires
    ON public.pending_manual_transfers(expires_at)
    WHERE consumed_at IS NULL;

ALTER TABLE public.pending_manual_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their pending transfers"
    ON public.pending_manual_transfers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships m
            WHERE m.tenant_id = pending_manual_transfers.tenant_id
              AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role manages pending transfers"
    ON public.pending_manual_transfers FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

Apply and regen types.

- [ ] **Step 2**: In `route.ts`, replace `Math.random().toString(36)...` with:
```ts
import { randomBytes } from 'crypto';
const randPart = randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars
```
Persist before responding:
```ts
await admin.from('pending_manual_transfers').insert({
    tenant_id: tenantId,
    user_id: user.id,
    variant_code: variant.code,
    reference_code: referenceCode,
    expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
});
```
The DB UNIQUE constraint protects against same-code reissue races.

- [ ] **Step 3**: Update existing unit test to mock the insert and assert it's called with the right shape. Run vitest, verify all pass.
- [ ] **Step 4**: Commit
```
git commit -m "fix(billing): persist manual transfer reference and use CSPRNG"
```

### Task 4: Fix `cancel-subscription` RLS bypass

**File:** `src/app/api/recurrente/cancel-subscription/route.ts`

The current code uses the user-scoped `supabase` client to UPDATE `subscriptions`. RLS only allows `service_role` UPDATE. Result: silent no-op.

- [ ] **Step 1**: Read the current handler.
- [ ] **Step 2**: After `requireUserTenant`, switch to admin client for the UPDATE only:
```ts
import { createAdminClient } from '@/lib/supabase/server';
const admin = createAdminClient();
const { error } = await admin
    .from('subscriptions')
    .update({ status: 'CANCELED', cancel_at: ... })
    .eq('tenant_id', tenantId);
```
Authorization is OK because we already validated the user belongs to `tenantId`.
- [ ] **Step 3**: Add a unit test that mocks both clients and asserts the admin client is used for the UPDATE.
- [ ] **Step 4**: Commit `fix(billing): cancel-subscription uses admin client to bypass RLS`.

### Task 5: Extend `logger.redact.paths` for financial PII

**File:** `src/lib/logger.ts`

- [ ] **Step 1**: Read current `redact` config.
- [ ] **Step 2**: Add: `bankReference`, `amount`, `creditor`, `balance`, `displayName`, `phone`, `address`, `*.email`, `metadata.email`, `metadata.bankReference`. Keep existing entries.
- [ ] **Step 3**: Add unit test that creates a test logger, logs an object with these fields, and asserts the output is redacted.
- [ ] **Step 4**: Commit `chore(logger): extend redact paths for financial PII`.

---

## FASE B — Cumplimiento regulatorio GT (Días 2-3)

### Task 6: Disclaimer financiero visible

**Files:**
- Create: `src/components/legal/financial-disclaimer.tsx`
- Modify: `src/app/(app)/plan/page.tsx`, `src/app/(app)/forecast/page.tsx`

```tsx
// src/components/legal/financial-disclaimer.tsx
import { AlertCircle } from 'lucide-react';

export function FinancialDisclaimer({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
    if (variant === 'compact') {
        return (
            <p className="text-xs text-muted-foreground border-t border-border/40 pt-2 mt-4">
                Esta es una herramienta de planificación informativa. No constituye asesoría financiera, contable ni legal.
                RutaCero no es entidad supervisada por la Superintendencia de Bancos de Guatemala.
            </p>
        );
    }
    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p>
                Esta es una herramienta de planificación informativa. No constituye asesoría financiera, contable ni legal.
                RutaCero no es entidad supervisada por la Superintendencia de Bancos de Guatemala.
            </p>
        </div>
    );
}
```

- [ ] Mount `<FinancialDisclaimer />` near the top of `/plan` and `/forecast`.
- [ ] Mount `<FinancialDisclaimer variant="compact" />` at the bottom of email templates that show a recommendation (`payment-reminder`, `lifecycle-email` if applicable).
- [ ] Commit `feat(legal): add financial disclaimer banner to plan and forecast`.

### Task 7: Self-service de eliminación de cuenta

**Files:**
- Create: `src/lib/actions/account-deletion.ts`
- Create: `src/app/(app)/settings/delete-account/page.tsx`
- Test: `__tests__/account-deletion.test.ts`

- [ ] **Step 1**: Server action `requestAccountDeletion(reason: string | null)` that:
  - Requires authenticated user via `requireUserTenant`.
  - Inserts into a new `account_deletion_requests` table (migration needed) with `requested_at`, `confirmed_at: null`, `executes_at: now()+7 days`.
  - Sends a confirmation email with a tokenized link to confirm.
  - Logs `audit_logs` with action `account.deletion_requested`.
- [ ] **Step 2**: `confirmAccountDeletion(token: string)` flips `confirmed_at`. Cron does the actual delete after `executes_at`.
- [ ] **Step 3**: UI page with double confirmation, password re-entry, "esto eliminará todas tus deudas, planes y pagos" warning. Disabled until checkbox checked.
- [ ] **Step 4**: Migration: `account_deletion_requests` table with RLS service-role-only.
- [ ] **Step 5**: Cron `/api/cron/process-deletions` (gated on `CRON_SECRET`) that picks confirmed+matured rows and deletes user, tenant memberships, profile, debts, payments, plans (cascade). Add to `vercel.json`.
- [ ] **Step 6**: Tests + commit `feat(privacy): self-service account deletion with 7-day grace period`.

### Task 8: Export CSV gratis para datos crudos del usuario

**File:** `src/lib/actions/export.ts`

- [ ] **Step 1**: Read current implementation.
- [ ] **Step 2**: Split into two functions:
  - `exportRawDebts()` and `exportRawPayments()` — available to FREE users; return only the user's own data with no analytics/scoring.
  - `exportAnalyticsCSV()` (existing) — keep PRO-gated.
- [ ] **Step 3**: Update UI in `/profile` or `/settings` to expose "Descargar mis deudas" / "Descargar mis pagos" sin gate. Add small note: "Exporta tus datos crudos sin costo (derecho de portabilidad)."
- [ ] **Step 4**: Tests + commit `fix(privacy): raw data export available to FREE users`.

### Task 9: Documentar decisión de FEL (no-código)

**File:** Create `docs/operational/fel-emission-policy.md` con:
- Quién emite (Recurrente vs RutaCero S.A. vs certificador externo).
- Para flujo Recurrente: confirmación escrita del proveedor sobre quién es el contribuyente emisor.
- Para flujo `manual_transfer`: timeline de cuándo se automatiza (volumen umbral) y cómo se emiten manualmente las primeras N facturas.
- Plan de contingencia: contacto de Cofidi/Megaprint/G&T con cotización inicial.

Esta task NO escribe código, solo documenta. Commit:
```
git commit -m "docs(operational): FEL emission policy and decision tree"
```

---

## FASE C — Credibilidad de landing en español (Días 3-4)

### Task 10: Pasada de tildes y ortografía

**Files:** todos los `src/components/landing/*.tsx`, `src/lib/launch/experience.ts`, `src/app/(app)/pricing/page.tsx`, `src/app/(auth)/{login,signup}/`, `src/app/(auth)/onboarding/page.tsx`.

- [ ] **Step 1**: `grep -rn "mas \|rapido\|estres\|prestamos\|adios\|sesion\|informacion\|acompanamiento\|por que\|Pruebalo\|debil\|numeros\|simbolos\|linea\|comun\|tambien\|despues\|facil\|telefono\|esta \|aqui\|alli\|asi\|Salvador\|envio\|anos" src/`
- [ ] **Step 2**: Reemplazar match por match con tildes correctas. `microcopy.ts` está bien escrito — úsalo de modelo.
- [ ] **Step 3**: Verificar visualmente las páginas afectadas en `npm run dev`.
- [ ] **Step 4**: Commit `chore(copy): apply Spanish accents across landing and auth surfaces`.

### Task 11: Anchors del footer

**File:** `src/components/landing/footer.tsx`, `features.tsx`, `faq.tsx`.

- [ ] Añadir `<section id="features">` y `<section id="faq">` en los componentes raíz correspondientes.
- [ ] Confirmar que `href="#features"` y `href="#faq"` en footer funcionan (smooth scroll si aplica).
- [ ] Commit `fix(landing): wire footer anchors to corresponding sections`.

### Task 12: Alinear pricing landing ↔ /pricing

**File:** `src/components/landing/pricing-preview.tsx`, `src/app/(app)/pricing/page.tsx`.

Decision: el landing solo muestra "desde Q49/mes" y empuja al `/pricing` para detalle. El landing NO duplica las 3 variantes.

- [ ] Reescribir `pricing-preview.tsx` para mostrar 2 cards (FREE + PRO desde Q49), con badge "3 variantes disponibles" sobre PRO y CTA "Ver planes" → `/pricing`.
- [ ] Sincronizar la lista de features FREE entre `pricing-preview.tsx` y `/pricing` (eliminar duplicados, decidir qué mostrar como "no incluido").
- [ ] Commit `fix(pricing): align landing preview with full pricing page`.

### Task 13: Sticky mobile nav con CTA

**Files:**
- Create: `src/components/landing/sticky-mobile-nav.tsx`
- Modify: `src/app/page.tsx` (raíz del landing)

- [ ] Componente que aparece tras scroll > 300px en mobile (`md:hidden`), con logo + "Empezar gratis" → `/signup`.
- [ ] Tests E2E opcional (`page.evaluate(() => window.scrollTo(0, 500))` y assert visible).
- [ ] Commit `feat(landing): sticky mobile nav with primary CTA`.

### Task 14: Footer con soporte / contacto / quiénes somos

**File:** `src/components/landing/footer.tsx`

- [ ] Añadir columna "Soporte" con `Contacto` (mailto), `Centro de ayuda` (link a `/help`), `Estado del servicio` si existe.
- [ ] Añadir columna "Empresa" con `Acerca de RutaCero`, `Privacidad`, `Términos`. (Crear `/about` minimalista si no existe — solo nombre del fundador, ubicación GT, año fundación.)
- [ ] Commit `feat(landing): footer support and company columns`.

### Task 15: FAQ ampliada + a11y accordion

**File:** `src/components/landing/faq.tsx`

- [ ] **Step 1**: Añadir `aria-expanded={openIndex === index}` y `aria-controls={"faq-panel-"+index}` al button.
- [ ] **Step 2**: Añadir `id={"faq-panel-"+index}` y `role="region"` al panel.
- [ ] **Step 3**: Añadir 4 preguntas nuevas:
  - "¿Quién está detrás de RutaCero?"
  - "¿RutaCero reporta o consulta mi historial de buró?"
  - "¿Cómo elimino mi cuenta y mis datos?"
  - "Si pago PRO y el servicio cierra, ¿qué pasa con mis datos?"
- [ ] **Step 4**: Commit `feat(landing): a11y FAQ accordion + 4 trust questions`.

### Task 15b: Subir password mínimo a 8 + bloquear si score bajo

**File:** `src/app/(auth)/signup/page.tsx`

- [ ] `minLength={8}`, bloquear submit si `passwordScore < 2`. Inline error explicit.
- [ ] Commit `fix(auth): enforce 8-char password minimum`.

---

## FASE D — Accesibilidad WCAG 2.1 AA (Días 5-6)

### Task 16: `<h1>` real en login y signup

**Files:** `src/app/(auth)/login/login-client.tsx`, `signup/page.tsx`.

- [ ] Reemplazar `<CardTitle>Bienvenido</CardTitle>` por `<h1 className="text-2xl font-bold">Bienvenido</h1>` (o equivalente Tailwind que respete el design).
- [ ] Misma corrección en signup.
- [ ] Commit `fix(a11y): real h1 on auth surfaces`.

### Task 17: `<Label htmlFor>` correcto en debts dialog

**File:** `src/app/(app)/debts/components/create-debt-dialog.tsx`

- [ ] Cada `<Label>` que envuelve un Select debe tener `htmlFor="some-id"` y el `<SelectTrigger id="some-id">`. Lo mismo para Inputs.
- [ ] Verificar contra `finances-client.tsx` que ya tiene el patrón correcto.
- [ ] Commit `fix(a11y): associate labels with form controls in debts dialog`.

### Task 18: `aria-label` en botones-icono

**Files:** `src/app/(app)/finances/finances-client.tsx`, cualquier otro `<Button size="icon">` sin texto.

- [ ] `grep -rn 'size="icon"' src/app src/components` para inventario.
- [ ] Por cada uno, añadir `aria-label` descriptivo (ej. `aria-label={\`Eliminar ingreso de \${income.source}\`}`).
- [ ] Commit `fix(a11y): aria-label on all icon-only buttons`.

### Task 19: `<form onSubmit>` en finanzas

**File:** `src/app/(app)/finances/finances-client.tsx`

- [ ] Envolver los dialogs de "Agregar Ingreso" / "Agregar Gasto" en `<form onSubmit={handleAddIncome}>` y cambiar el botón a `type="submit"`. Enter ahora envía.
- [ ] Commit `fix(a11y): native form submission on finances dialogs`.

### Task 20: `useReducedMotion` wrapper + Typewriter pausable

**Files:** `src/components/ui/typewriter.tsx`, `src/components/landing/hero.tsx`, `cta-section.tsx`.

- [ ] Crear `src/hooks/use-reduced-motion-safe.ts` que envuelve `useReducedMotion` de framer y devuelve `true` cuando el usuario prefiere reduced motion.
- [ ] En `Typewriter`: si reduced, mostrar la primera palabra estáticamente y omitir el setInterval. Añadir botón "Pausar / Reanudar" pequeño junto al texto cuando NO sea reduced.
- [ ] En `hero.tsx`: envolver los `motion.div` decorativos (líneas 43-78) en check de reduced; si reduced, no animar pero conservar la posición/forma.
- [ ] Mismo patrón en `cta-section.tsx`.
- [ ] Commit `feat(a11y): respect prefers-reduced-motion across landing animations`.

### Task 21: `role="alert"` + `aria-describedby` en errores de login

**File:** `src/app/(auth)/login/login-client.tsx`

- [ ] El div con `bg-red-50 text-red-700` que muestra el error → añadir `role="alert"` y `id="login-error"`.
- [ ] Inputs → `aria-invalid={hasError}` + `aria-describedby={hasError ? "login-error" : undefined}`.
- [ ] Commit `fix(a11y): announce login errors via aria-live region`.

### Task 22: axe-core en CI

**Files:** `package.json`, nuevo `e2e/a11y.spec.ts`, `.github/workflows/ci.yml`.

- [ ] `npm install -D @axe-core/playwright`.
- [ ] Crear `e2e/a11y.spec.ts` que visita `/`, `/login`, `/signup`, `/pricing`, `/dashboard` (logueado), `/admin/dashboard` (logueado admin), corre `axe` y falla si hay violations de severity `serious|critical`.
- [ ] Añadir el spec a `test:e2e:critical`.
- [ ] Verificar en CI workflow.
- [ ] Commit `test(a11y): axe-core gate on critical surfaces`.

---

## FASE E — Dashboard primera ejecución (Día 7)

### Task 23: First-run welcome cuando no hay deudas

**Files:**
- Create: `src/components/dashboard/first-run-welcome.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] El dashboard server-side ya hace fetch de `debts.length`. Si `=== 0`, renderizar `<FirstRunWelcome />` en vez del grid de 8 cards.
- [ ] El componente: hero amigable con nombre del usuario, una sola CTA primaria "Agrega tu primera deuda", una secundaria "Ver cómo funciona" que abra un modal con video/screenshots.
- [ ] Tras añadir la primera deuda, el dashboard normal aparece automáticamente (server re-render).
- [ ] Commit `feat(dashboard): first-run welcome state for empty users`.

### Task 24: Personalizar header del dashboard

**File:** `src/app/(app)/dashboard/page.tsx`

- [ ] Reemplazar "Bienvenido de vuelta" por algo que use `user_profile.full_name` o `user.email.split('@')[0]`. Si es la primera sesión (heurística: `created_at - now() < 1h`), decir "Bienvenido a RutaCero".
- [ ] Las dos pills de "Plan recomendado actualizado" / "Revisa tus alertas pendientes" deben renderizarse condicionalmente solo si hay datos reales.
- [ ] Commit `fix(dashboard): personalize header and remove ghost pills`.

### Task 25: Onboarding captura motivación

**File:** `src/app/(auth)/onboarding/page.tsx`

- [ ] Añadir un paso opcional: "¿Qué te trajo a RutaCero?" con 4 opciones (radio group): "Estoy estresado por la deuda", "Quiero ahorrar en intereses", "Voy a comprar algo grande pronto", "Solo quiero entender mis números".
- [ ] Persistir en `user_profiles.onboarding_motivation` (migración pequeña).
- [ ] Commit `feat(onboarding): capture motivation for downstream personalization`.

---

## FASE F — WhatsApp como canal (Días 8-10)

### Task 26: Migración WhatsApp opt-ins

**File:** `supabase/migrations/044_whatsapp_optins.sql`

```sql
CREATE TABLE IF NOT EXISTS public.whatsapp_optins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    phone_e164 VARCHAR(20) NOT NULL,
    verified_at TIMESTAMPTZ,
    opted_out_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_optins_phone ON public.whatsapp_optins(phone_e164);

ALTER TABLE public.whatsapp_optins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own optin"
    ON public.whatsapp_optins FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "User can manage own optin"
    ON public.whatsapp_optins FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "User can update own optin"
    ON public.whatsapp_optins FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages whatsapp optins"
    ON public.whatsapp_optins FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

Apply + regen types. Commit `feat(db): whatsapp opt-ins table with RLS`.

### Task 27: WhatsApp client + plantillas

**Files:**
- Create: `src/lib/whatsapp/client.ts`
- Create: `src/lib/whatsapp/templates.ts`
- Modify: `.env.example` (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`)

- [ ] `client.ts`: wrapper sobre `fetch` a `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`. Function `sendTemplate({ to, templateName, lang, parameters })` retorna `{ ok, messageId | error }`. NO retry built-in (el cron lo maneja).
- [ ] `templates.ts`: catálogo TS-side de plantillas conocidas con su nombre, idioma (`es`), y schema zod de los parámetros que aceptan. Plantillas previstas: `payment_reminder_1d`, `payment_due_today`, `payment_overdue_3d`, `weekly_progress`. **NOTA**: estas plantillas deben estar aprobadas en Meta antes de funcionar; el setup en Meta es paralelo y no-código.
- [ ] Tests: mock fetch, asegurar payload bien construido y errores propagados.
- [ ] Commit `feat(whatsapp): client and template catalog`.

### Task 28: Endpoint opt-in + UI en settings

**Files:**
- Create: `src/app/api/whatsapp/optin/route.ts`
- Create section in `src/app/(app)/settings/page.tsx`

- [ ] Endpoint POST `{ phoneE164 }`. Valida formato E.164 (regex `^\+[1-9]\d{6,14}$`). Inserta opt-in. (La verificación por OTP es v2; en v1 el opt-in es declarativo y se confía en el usuario; no se mandan templates a numeros sin verificación de WhatsApp por la propia API de Meta.)
- [ ] UI en settings: input teléfono + botón "Activar recordatorios por WhatsApp". Toggle para opt-out.
- [ ] Commit `feat(whatsapp): user opt-in flow`.

### Task 29: Cron diario de recordatorios

**File:** `src/app/api/cron/whatsapp-reminders/route.ts`

- [ ] Endpoint GET protegido por `Bearer CRON_SECRET`.
- [ ] Query: opt-ins activos × deudas con `payment_day` que cae en {hoy+1, hoy} y donde `last_whatsapp_reminder_at` no esté en últimas 24h.
- [ ] Para cada match, llamar `sendTemplate('payment_reminder_1d' o 'payment_due_today')`.
- [ ] Update `last_whatsapp_reminder_at` y `last_message_at` del opt-in.
- [ ] Añadir a `vercel.json` cron schedule diario `0 13 * * *` (13h UTC = 7am GT).
- [ ] Tests: mock client + DB, asegurar que se respeta opt-out y dedup.
- [ ] Commit `feat(whatsapp): daily reminders cron`.

---

## FASE G — Cierre del ciclo de pago (Días 11-12)

### Task 30: Migración `payments.receipt_url` + Storage bucket

**Files:**
- Create: `supabase/migrations/043_payments_receipt_url.sql`
- Setup: bucket `payment-receipts` en Supabase Storage (config local)

```sql
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;
```

- [ ] Apply + regen types.
- [ ] En Storage: crear bucket `payment-receipts` con policy:
  - INSERT: usuario autenticado escribe a `${user.id}/${tenant.id}/${payment.id}.{jpg|pdf}`.
  - SELECT: solo `service_role` o el dueño.
- [ ] Commit `feat(db): receipt_url on payments + storage bucket policy`.

### Task 31: Capacitor Camera plugin + flujo upload

**Files:**
- Modify: `package.json` (`@capacitor/camera`)
- Create: `src/lib/storage/receipts.ts` — `uploadReceipt(paymentId, file): Promise<{url}>`
- Create: `src/app/(app)/payments/[paymentId]/upload-receipt/page.tsx`

- [ ] `npm install @capacitor/camera` y `npx cap sync android`.
- [ ] `receipts.ts`: helper para subir a Supabase Storage; valida `image/*` o `application/pdf`, máx 5MB.
- [ ] UI: botón "Tomar foto" (Camera plugin si en Android, `<input type="file" capture>` si web), preview, botón "Subir". Al subir, actualiza `payments.receipt_url` y `receipt_uploaded_at`.
- [ ] Tests E2E ligeros (smoke).
- [ ] Commit `feat(payments): receipt photo upload (web + Android)`.

### Task 32: Mostrar comprobante en historial de pagos

**File:** `src/app/(app)/payments/page.tsx` (o el componente que liste pagos)

- [ ] Si `payment.receipt_url`, mostrar miniatura clickable; si no, mostrar botón "Subir comprobante" → `/payments/${id}/upload-receipt`.
- [ ] Commit `feat(payments): show receipt in payment history`.

---

## FASE H — Operación y observabilidad (Día 13)

### Task 33: Sentry alertas configuradas

**File:** `src/lib/observability/sentry-alerts.md` (runbook, no código)

Documentar (en disco) qué reglas crear en el dashboard de Sentry:
- Alerta P1: `>5 errores en 5 min` en `event.transaction` matching `/api/billing/.*`.
- Alerta P1: cualquier error con tag `level:fatal`.
- Alerta P2: errores nuevos sin agrupación previa, daily digest.
- Alerta release: comparar error rate antes/después de release.
- Notify: email + Slack si configurado.

- [ ] Crear el runbook.
- [ ] Aplicar las reglas en el dashboard Sentry (acción humana, NO código).
- [ ] Commit `docs(observability): Sentry alert rules runbook`.

### Task 34: Verificar `vercel.json` y SPF/DKIM

**File:** `vercel.json`

- [ ] Confirmar que existen schedules para `payment-reminders`, `lifecycle`, `security-maintenance`, `whatsapp-reminders`, `process-deletions`. Crear si faltan.
- [ ] Documentar timezone (Vercel runs UTC; convertir GT-6 a UTC).
- [ ] **Acción humana**: en el panel de Resend, verificar SPF/DKIM de `rutacero.com`. Documentar en `docs/operational/email-domain.md`.
- [ ] Commit `chore(operational): verify cron schedules and email domain config`.

### Task 35: Backup verificado

**Files:** `scripts/backup-prod.sh` (nuevo), `docs/operational/backup-runbook.md`.

- [ ] Script que hace `pg_dump` (via Supabase pooler o branching) y sube a un bucket S3-compatible (Backblaze B2 free tier).
- [ ] Cron mensual `npm run verify:restore:staging` que toma último backup y lo restaura en una DB de staging y corre validaciones de integridad.
- [ ] Commit `feat(operational): production backup script and verification runbook`.

---

## FASE I — Smoke test del funnel completo (Día 14)

### Task 36: Lighthouse + funnel manual

- [ ] Ejecutar Lighthouse mobile-throttled en `/`, `/pricing`, `/signup`, `/dashboard`. Apuntar a:
  - LCP < 2.5s, CLS < 0.1, INP < 200ms.
  - Performance score >= 80, A11y >= 95, SEO >= 90.
- [ ] Smoke manual end-to-end en Android low-end real (Snapdragon 4xx, 4GB):
  1. Abrir `/` en Chrome móvil.
  2. Click "Empezar gratis" → completar signup.
  3. Onboarding 4 pasos.
  4. Dashboard first-run aparece.
  5. Agregar primera deuda manualmente.
  6. Ver plan generado.
  7. Activar opt-in WhatsApp.
  8. Subir comprobante simulado.
  9. Cancelar suscripción (si tiene PRO).
  10. Eliminar cuenta.
- [ ] Documentar resultados en `docs/operational/launch-readiness.md` con captures.
- [ ] Si todo pasa, abrir PR a `main` con resumen de los 35 commits.

---

## Self-Review

**1. Spec coverage:**
- Hardening seguridad → T1-T5 (RLS billing_entitlements, deps, manual transfer crypto+persist, cancel-sub admin, logger redact).
- Regulatorio GT → T6-T9 (disclaimer, eliminación cuenta, export FREE, FEL doc).
- Credibilidad landing → T10-T15b (tildes, anchors, pricing align, sticky nav, footer, FAQ, password).
- A11y WCAG AA → T16-T22 (`<h1>`, labels, aria-label, form, reduced motion, role=alert, axe).
- Dashboard first-run → T23-T25 (welcome, header personalizado, onboarding motivation).
- WhatsApp → T26-T29 (migration, client+templates, opt-in, cron).
- Ciclo de pago → T30-T32 (receipt_url, upload, history).
- Operación → T33-T35 (Sentry alertas, vercel.json, backup).
- Smoke final → T36.

**2. Placeholder scan:** no "TBD". Todas las tareas con código de ejemplo concreto donde aplica. Las 3 tasks no-código (T9 FEL, T33 Sentry rules, T35 backup) están claramente marcadas como operativas.

**3. Type consistency:** `pending_manual_transfers`, `whatsapp_optins`, `account_deletion_requests` siguen el patrón de migrations 037-040 (RLS service-role + member SELECT). `FinancialDisclaimer` props consistentes. `sendTemplate` schema match con tabla de catálogo.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-09-pre-launch.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Despacho un subagente fresco por task con review entre tareas (mismo workflow de la última iteración: implementer → spec reviewer → code reviewer). Ideal para las 36 tasks.

**2. Inline Execution** — Ejecutar tasks aquí mismo en batches con checkpoints.

**¿Cuál prefieres? O ¿prefieres priorizar algunas (ej. solo Fase A + B = bloqueantes reales) y dejar el resto para una segunda iteración?**
