# RutaCero Monetización Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activar 6 fases de monetización para usuarios con baja educación financiera en Guatemala, sin pagar a proveedores nuevos para implementar.

**Architecture:** Construir sobre la infraestructura existente (multi-tenant por workspace + RLS, billing por tenant en `subscriptions`, sistema de partners en `/partners/[partnerSlug]`, eventos de funnel en `marketing_funnel_events`, billing dual web/Android). Diferenciar la oferta por intervalo (mensual/trimestral/anual) y abrir canales de pago locales (transferencia bancaria con activación manual desde admin) sin onboardear nuevos PSPs. Para observabilidad, reusar la tabla de eventos ya instrumentada y añadir Sentry en su free tier (sin costo de implementación).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres + RLS + Realtime), Recurrente (cobro web GTQ), Google Play Billing (pase Android), Resend (email), Sentry SDK (`@sentry/nextjs` free tier 5k errors/mes), eventos de funnel propios ya en código.

**Restricción del usuario:** todo lo que se implemente debe ser **gratuito al menos para implementación**. Por eso el plan rechaza PostHog/Mixpanel pagos, KMS pagos, integraciones SMS pagas, etc. WhatsApp Business Cloud API se usa en su tier gratis (1k conversaciones/mes service-initiated). Sentry free tier califica.

**Estado base verificado:** local == `origin/main` en commit `6186449`. `viewport` en `src/app/layout.tsx:53` ya **NO** restringe zoom (la queja P0 del análisis chairman ya está resuelta).

---

## Fases (resumen)

| # | Fase | Tareas | Costo terceros | En este plan |
|---|---|---|---|---|
| 0 | Observabilidad mínima | T1, T2 | Sentry free | Sí (TDD detallado) |
| 1 | Reposicionamiento de oferta (precios + copy + Android pase 90d) | T3-T9 | $0 | Sí (TDD detallado) |
| 2 | Pago por transferencia bancaria con activación manual | T10-T15 | $0 | Sí (TDD detallado) |
| 3 | Onboarding con captura de intención + método de pago preferido | — | $0 | **Sub-plan** (spec corta abajo) |
| 4 | Dashboard B2B2C explotando partners + página /empresas | — | $0 | **Sub-plan** |
| 5 | Recordatorios premium WhatsApp + asesoría humana 1-a-1 | — | WhatsApp Cloud free | **Sub-plan** |

---

## File Structure

Archivos que **se crean o modifican** en este plan (Fases 0-2):

**Crear:**
- `src/lib/observability/sentry-init.ts` — wrapper único para `Sentry.init` con guard por env
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — configs requeridas por `@sentry/nextjs`
- `src/lib/billing/plans.ts` — catálogo único de variantes PRO (mensual/trimestral/anual + pase Android)
- `src/app/admin/funnel/page.tsx` — vista interna de conversión
- `src/lib/actions/admin-funnel.ts` — server action que computa el funnel desde `marketing_funnel_events`
- `src/lib/actions/admin-billing.ts` — server action para conceder PRO manual
- `src/app/admin/customers/[tenantId]/billing/page.tsx` — UI admin del grant manual
- `src/app/(public)/pago-manual/page.tsx` — instrucciones públicas de pago por transferencia
- `src/app/api/billing/manual-transfer/route.ts` — endpoint para iniciar solicitud de pago manual
- `src/lib/emails/transfer-instructions.tsx` — email con datos bancarios
- `supabase/migrations/037_subscription_billing_variant.sql` — añade `billing_interval`, `price_amount_q`, `payment_method`
- `supabase/migrations/038_manual_payment_grants.sql` — auditoría de activaciones manuales
- `__tests__/billing/plans.test.ts`, `__tests__/admin/admin-funnel.test.ts`, `__tests__/admin/admin-billing.test.ts`, `__tests__/api/manual-transfer.test.ts`
- `e2e/manual-transfer.spec.ts`

**Modificar:**
- `package.json` (añadir `@sentry/nextjs`)
- `next.config.ts` (envolver con `withSentryConfig`)
- `.env.example` (añadir vars de Sentry, transferencia bancaria, GP pase 90d)
- `src/lib/recurrente/client.ts` (añadir `oneTime: boolean` y soporte `interval` ampliado)
- `src/app/api/recurrente/create-checkout/route.ts` (recibir `variantCode`, validar contra catálogo)
- `src/app/(app)/pricing/page.tsx` (3 columnas de PRO + copy basado en resultado)
- `src/lib/billing/google-play-config.ts` (constante de duración configurable)
- `src/components/landing/hero.tsx`, `src/components/landing/features.tsx`, `src/components/landing/cta-section.tsx` (eliminar claims sin sustento)

Cada archivo tiene una responsabilidad clara. `src/lib/billing/plans.ts` es el **single source of truth** para precios y variantes; el resto consulta a esa capa.

---

## Convenciones de cada Task

- **TDD estricto:** test que falla → implementación mínima → test pasa → commit.
- **Comandos exactos:** cada step de "run tests" muestra el comando y la salida esperada (FAIL/PASS).
- **Commits frecuentes:** un commit por step de implementación verificada. Ningún `git push`.
- **Sin `any`:** prohibido introducir `any` nuevos. Usa `unknown` + zod.
- **No tocar `node_modules` ni `package-lock.json` manualmente:** solo vía `npm install`.
- **Cuando el step toca DB:** ejecutar `npm run db:push:local` después de la migración y `npm run db:reset:local` solo si la migración previa cambió.

---

## Task 1: Instrumentar Sentry (errores frontend + backend)

**Files:**
- Modify: `package.json` (añadir dependency)
- Create: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Create: `src/lib/observability/sentry-init.ts`
- Modify: `next.config.ts:1` (envolver export con `withSentryConfig`)
- Modify: `.env.example` (añadir `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
- Test: `__tests__/observability/sentry-init.test.ts`

- [ ] **Step 1: Añadir dependency**

```bash
npm install --save @sentry/nextjs
```

Expected: `package.json` muestra `"@sentry/nextjs": "^10.x"` en `dependencies`. **No** correr `@sentry/wizard` (modifica archivos sin pedir permiso).

- [ ] **Step 2: Test que falla — el wrapper no inicializa si no hay DSN**

Crear `__tests__/observability/sentry-init.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const initMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
    init: initMock,
}));

describe('initSentry', () => {
    beforeEach(() => {
        initMock.mockClear();
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    });

    it('does not call Sentry.init when DSN is missing', async () => {
        const { initSentry } = await import('@/lib/observability/sentry-init');
        initSentry({ runtime: 'server' });
        expect(initMock).not.toHaveBeenCalled();
    });

    it('calls Sentry.init when DSN is present', async () => {
        process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
        vi.resetModules();
        const { initSentry } = await import('@/lib/observability/sentry-init');
        initSentry({ runtime: 'server' });
        expect(initMock).toHaveBeenCalledTimes(1);
        expect(initMock.mock.calls[0][0]).toMatchObject({
            dsn: 'https://example@sentry.io/1',
        });
    });
});
```

- [ ] **Step 3: Run test — debe FALLAR con "module not found"**

Run: `npx vitest run __tests__/observability/sentry-init.test.ts`
Expected: FAIL — `Cannot find module '@/lib/observability/sentry-init'`.

- [ ] **Step 4: Crear `src/lib/observability/sentry-init.ts`**

```typescript
import * as Sentry from '@sentry/nextjs';

interface InitSentryOptions {
    runtime: 'client' | 'server' | 'edge';
}

export function initSentry(opts: InitSentryOptions): void {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
        return;
    }
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: opts.runtime === 'client' ? 0.1 : 0.05,
        sendDefaultPii: false,
        beforeSend(event) {
            if (event.request?.cookies) {
                delete event.request.cookies;
            }
            if (event.user?.email) {
                event.user.email = '[redacted]';
            }
            return event;
        },
    });
}
```

- [ ] **Step 5: Run test — debe PASAR**

Run: `npx vitest run __tests__/observability/sentry-init.test.ts`
Expected: PASS — 2/2 tests.

- [ ] **Step 6: Crear los tres entrypoints requeridos por @sentry/nextjs**

`sentry.client.config.ts`:
```typescript
import { initSentry } from '@/lib/observability/sentry-init';
initSentry({ runtime: 'client' });
```

`sentry.server.config.ts`:
```typescript
import { initSentry } from '@/lib/observability/sentry-init';
initSentry({ runtime: 'server' });
```

`sentry.edge.config.ts`:
```typescript
import { initSentry } from '@/lib/observability/sentry-init';
initSentry({ runtime: 'edge' });
```

- [ ] **Step 7: Envolver next.config.ts**

Editar `next.config.ts`. Encontrar la línea final `export default nextConfig;` y reemplazarla por:

```typescript
import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
    automaticVercelMonitors: false,
});
```

(Si el archivo ya tiene `import` al tope, mover `import { withSentryConfig }` con los otros imports.)

- [ ] **Step 8: Añadir vars a `.env.example`**

Append al final:
```
# Sentry (free tier)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 9: Validar build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS sin warnings nuevos. Build sin DSN configurado debe completar (initSentry retorna temprano).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts next.config.ts .env.example src/lib/observability/sentry-init.ts __tests__/observability/sentry-init.test.ts
git commit -m "feat(observability): add Sentry SDK with DSN-gated init"
```

---

## Task 2: Vista admin de funnel (sin proveedor externo)

**Files:**
- Create: `src/lib/actions/admin-funnel.ts`
- Create: `src/app/admin/funnel/page.tsx`
- Test: `__tests__/admin/admin-funnel.test.ts`

**Por qué no PostHog:** ya hay tabla `marketing_funnel_events` con eventos `pricing_viewed`, `checkout_started`, `payment_succeeded`, etc. (`src/lib/funnel/events.ts:10-23`). Construimos el dashboard sobre esa tabla. Cero costo.

- [ ] **Step 1: Test que falla — `computeFunnel` calcula tasas**

Crear `__tests__/admin/admin-funnel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeFunnel } from '@/lib/actions/admin-funnel';

describe('computeFunnel', () => {
    it('computes step counts and conversion rates', () => {
        const events = [
            { event_name: 'pricing_viewed' },
            { event_name: 'pricing_viewed' },
            { event_name: 'pricing_viewed' },
            { event_name: 'pricing_viewed' },
            { event_name: 'checkout_started' },
            { event_name: 'checkout_started' },
            { event_name: 'payment_succeeded' },
        ];
        const result = computeFunnel(events);
        expect(result.pricing_viewed).toBe(4);
        expect(result.checkout_started).toBe(2);
        expect(result.payment_succeeded).toBe(1);
        expect(result.conversion_pricing_to_checkout).toBeCloseTo(0.5);
        expect(result.conversion_checkout_to_payment).toBeCloseTo(0.5);
        expect(result.conversion_pricing_to_payment).toBeCloseTo(0.25);
    });

    it('returns zero rates when no events', () => {
        const result = computeFunnel([]);
        expect(result.conversion_pricing_to_payment).toBe(0);
    });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run __tests__/admin/admin-funnel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar la función pura primero**

Crear `src/lib/actions/admin-funnel.ts`:

```typescript
'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/actions/admin-auth';

const STEPS = ['pricing_viewed', 'checkout_started', 'payment_succeeded'] as const;
type Step = (typeof STEPS)[number];

export interface FunnelResult extends Record<Step, number> {
    conversion_pricing_to_checkout: number;
    conversion_checkout_to_payment: number;
    conversion_pricing_to_payment: number;
}

export function computeFunnel(events: Array<{ event_name: string }>): FunnelResult {
    const counts: Record<Step, number> = {
        pricing_viewed: 0,
        checkout_started: 0,
        payment_succeeded: 0,
    };
    for (const e of events) {
        if ((STEPS as readonly string[]).includes(e.event_name)) {
            counts[e.event_name as Step] += 1;
        }
    }
    const safe = (n: number, d: number) => (d === 0 ? 0 : n / d);
    return {
        ...counts,
        conversion_pricing_to_checkout: safe(counts.checkout_started, counts.pricing_viewed),
        conversion_checkout_to_payment: safe(counts.payment_succeeded, counts.checkout_started),
        conversion_pricing_to_payment: safe(counts.payment_succeeded, counts.pricing_viewed),
    };
}

export async function getFunnelLast30Days(): Promise<FunnelResult> {
    await requireAdminSession();
    const admin = createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
        .from('marketing_funnel_events')
        .select('event_name')
        .gte('occurred_at', since);
    if (error) throw error;
    return computeFunnel(data ?? []);
}
```

> **Nota:** verificar que `requireAdminSession` exista en `src/lib/actions/admin-auth.ts`. Si la función real tiene otro nombre (p. ej. `verifyAdminSession`), ajustar el import. **No** crear una nueva — reusar la existente.

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run __tests__/admin/admin-funnel.test.ts`
Expected: PASS 2/2.

- [ ] **Step 5: Crear UI admin**

Crear `src/app/admin/funnel/page.tsx`:

```tsx
import { getFunnelLast30Days } from '@/lib/actions/admin-funnel';

export const dynamic = 'force-dynamic';

export default async function AdminFunnelPage() {
    const funnel = await getFunnelLast30Days();
    const fmt = (n: number) => `${(n * 100).toFixed(1)}%`;
    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Funnel últimos 30 días</h1>
            <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Pricing visto" value={funnel.pricing_viewed} />
                <Stat label="Checkout iniciado" value={funnel.checkout_started} />
                <Stat label="Pago exitoso" value={funnel.payment_succeeded} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Pricing → Checkout" value={fmt(funnel.conversion_pricing_to_checkout)} />
                <Stat label="Checkout → Pago" value={fmt(funnel.conversion_checkout_to_payment)} />
                <Stat label="Pricing → Pago" value={fmt(funnel.conversion_pricing_to_payment)} />
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
        </div>
    );
}
```

- [ ] **Step 6: Validar typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/admin-funnel.ts src/app/admin/funnel/page.tsx __tests__/admin/admin-funnel.test.ts
git commit -m "feat(admin): internal funnel dashboard from marketing_funnel_events"
```

---

## Task 3: Migration — `subscriptions.billing_interval` + `price_amount_q` + `payment_method`

**Files:**
- Create: `supabase/migrations/037_subscription_billing_variant.sql`

- [ ] **Step 1: Crear migration**

```sql
-- 037_subscription_billing_variant.sql
-- Permite múltiples variantes PRO (mensual/trimestral/anual) y registrar
-- el método de pago efectivo (recurrente, google_play, manual_transfer).

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(16) NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly', 'pass_30d', 'pass_90d')),
    ADD COLUMN IF NOT EXISTS price_amount_q NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'recurrente'
        CHECK (payment_method IN ('recurrente', 'google_play', 'manual_transfer', 'admin_grant', 'free'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_interval ON public.subscriptions(billing_interval);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method ON public.subscriptions(payment_method);

COMMENT ON COLUMN public.subscriptions.billing_interval IS 'Variante de cobro PRO. pass_30d/pass_90d para Google Play.';
COMMENT ON COLUMN public.subscriptions.price_amount_q IS 'Monto cobrado en GTQ por este período. NULL para FREE.';
COMMENT ON COLUMN public.subscriptions.payment_method IS 'Canal por el que se cobró/activó la suscripción.';
```

- [ ] **Step 2: Aplicar migración local**

Run: `npm run db:push:local`
Expected: `Applying migration 037_subscription_billing_variant.sql...` → success.

- [ ] **Step 3: Verificar en Supabase Studio**

Abrir [http://127.0.0.1:54323](http://127.0.0.1:54323) → tabla `subscriptions` → confirmar 3 columnas nuevas.

- [ ] **Step 4: Regenerar tipos de Supabase**

Run: `npx supabase gen types typescript --local > src/types/supabase.ts`
Expected: `subscriptions` row type incluye `billing_interval`, `price_amount_q`, `payment_method`.

- [ ] **Step 5: Validar build**

Run: `npm run typecheck`
Expected: PASS — los archivos que leen `subscriptions` siguen compilando porque las columnas tienen DEFAULT.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/037_subscription_billing_variant.sql src/types/supabase.ts
git commit -m "feat(db): add billing_interval and payment_method to subscriptions"
```

---

## Task 4: Catálogo único de variantes PRO (`src/lib/billing/plans.ts`)

**Files:**
- Create: `src/lib/billing/plans.ts`
- Test: `__tests__/billing/plans.test.ts`

- [ ] **Step 1: Test que falla**

Crear `__tests__/billing/plans.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PRO_VARIANTS, getProVariant, monthlyEquivalent } from '@/lib/billing/plans';

describe('PRO_VARIANTS', () => {
    it('exposes 4 variants with stable codes', () => {
        const codes = PRO_VARIANTS.map((v) => v.code).sort();
        expect(codes).toEqual(['PRO_ANNUAL', 'PRO_MONTHLY', 'PRO_PASS_90D', 'PRO_QUARTERLY']);
    });

    it('annual is cheaper per month than monthly', () => {
        expect(monthlyEquivalent('PRO_ANNUAL')).toBeLessThan(monthlyEquivalent('PRO_MONTHLY'));
    });

    it('quarterly is cheaper per month than monthly', () => {
        expect(monthlyEquivalent('PRO_QUARTERLY')).toBeLessThan(monthlyEquivalent('PRO_MONTHLY'));
    });

    it('throws on unknown variant', () => {
        expect(() => getProVariant('UNKNOWN' as unknown as 'PRO_MONTHLY')).toThrow();
    });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run __tests__/billing/plans.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar el catálogo**

Crear `src/lib/billing/plans.ts`:

```typescript
export type ProVariantCode =
    | 'PRO_MONTHLY'
    | 'PRO_QUARTERLY'
    | 'PRO_ANNUAL'
    | 'PRO_PASS_90D';

export interface ProVariant {
    code: ProVariantCode;
    label: string;
    priceQ: number;
    durationDays: number;
    recurrenteInterval: 'monthly' | 'yearly' | null;
    isOneTime: boolean;
    headline: string;
    discountVsMonthly: number;
}

export const PRO_VARIANTS: readonly ProVariant[] = [
    {
        code: 'PRO_MONTHLY',
        label: 'PRO mensual',
        priceQ: 49,
        durationDays: 30,
        recurrenteInterval: 'monthly',
        isOneTime: false,
        headline: 'Q49 al mes',
        discountVsMonthly: 0,
    },
    {
        code: 'PRO_QUARTERLY',
        label: 'PRO trimestral',
        priceQ: 119,
        durationDays: 90,
        recurrenteInterval: null,
        isOneTime: true,
        headline: 'Q119 cada 3 meses (Q39.66/mes)',
        discountVsMonthly: 0.19,
    },
    {
        code: 'PRO_ANNUAL',
        label: 'PRO anual',
        priceQ: 399,
        durationDays: 365,
        recurrenteInterval: 'yearly',
        isOneTime: false,
        headline: 'Q399 al año (Q33.25/mes)',
        discountVsMonthly: 0.32,
    },
    {
        code: 'PRO_PASS_90D',
        label: 'Pase Android 90 días',
        priceQ: 99,
        durationDays: 90,
        recurrenteInterval: null,
        isOneTime: true,
        headline: 'Q99 por 90 días en Google Play',
        discountVsMonthly: 0.33,
    },
];

export function getProVariant(code: ProVariantCode): ProVariant {
    const found = PRO_VARIANTS.find((v) => v.code === code);
    if (!found) {
        throw new Error(`Unknown PRO variant: ${code}`);
    }
    return found;
}

export function monthlyEquivalent(code: ProVariantCode): number {
    const v = getProVariant(code);
    const months = v.durationDays / 30;
    return v.priceQ / months;
}
```

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run __tests__/billing/plans.test.ts`
Expected: PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/plans.ts __tests__/billing/plans.test.ts
git commit -m "feat(billing): add PRO variant catalog (monthly, quarterly, annual, 90d pass)"
```

---

## Task 5: Extender create-checkout para aceptar variant

**Files:**
- Modify: `src/lib/recurrente/client.ts:15-25` (ampliar `CreateCheckoutParams.interval` y añadir `oneTime` flag)
- Modify: `src/app/api/recurrente/create-checkout/route.ts:16-21` (parametrizar plan)
- Test: `__tests__/api/create-checkout-variant.test.ts`

- [ ] **Step 1: Test que falla — el endpoint rechaza variantes desconocidas**

Crear `__tests__/api/create-checkout-variant.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { PRO_VARIANTS } from '@/lib/billing/plans';

const variantCodes = PRO_VARIANTS.map((v) => v.code) as [string, ...string[]];

const Body = z.object({
    variantCode: z.enum(variantCodes),
    ctaContext: z.string().nullable().optional(),
});

describe('create-checkout body schema', () => {
    it('accepts known variants', () => {
        expect(Body.parse({ variantCode: 'PRO_ANNUAL' }).variantCode).toBe('PRO_ANNUAL');
    });
    it('rejects unknown variants', () => {
        expect(() => Body.parse({ variantCode: 'PRO_FOO' })).toThrow();
    });
    it('rejects 90d pass on web (Android-only) — handled in route, not schema', () => {
        // Schema-level test only validates string; the route enforces channel.
        expect(Body.parse({ variantCode: 'PRO_PASS_90D' }).variantCode).toBe('PRO_PASS_90D');
    });
});
```

> Nota: validar el rechazo del pase Android-only en el endpoint (Step 4), no en el schema.

- [ ] **Step 2: Run — debe FALLAR**

Run: `npx vitest run __tests__/api/create-checkout-variant.test.ts`
Expected: FAIL — `Body` aún no existe en código real (solo en el test).

- [ ] **Step 3: Implementar zod body en el route**

Editar `src/app/api/recurrente/create-checkout/route.ts`. En la sección de imports añadir:

```typescript
import { z } from 'zod';
import { PRO_VARIANTS, getProVariant, type ProVariantCode } from '@/lib/billing/plans';
```

Reemplazar el bloque `const PRO_PLAN = { ... }` (líneas ~16-21) por:

```typescript
const variantCodes = PRO_VARIANTS.map((v) => v.code) as [ProVariantCode, ...ProVariantCode[]];

const CheckoutBody = z.object({
    variantCode: z.enum(variantCodes).default('PRO_MONTHLY'),
    ctaContext: z.string().nullable().optional(),
});
```

Cambiar el parsing del body (encontrar `const requestBody = await request.json().catch(() => null) as ...`):

```typescript
const parsed = CheckoutBody.safeParse(await request.json().catch(() => ({})));
if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_VARIANT' }, { status: 400 });
}
const { variantCode, ctaContext } = parsed.data;
const variant = getProVariant(variantCode);

if (variant.code === 'PRO_PASS_90D') {
    return NextResponse.json(
        { error: 'ANDROID_ONLY_VARIANT', message: 'PRO_PASS_90D solo está disponible vía Google Play.' },
        { status: 400 }
    );
}
```

Y en la llamada a `recurrente.createCheckout`, sustituir `PRO_PLAN.price`/`interval` por `variant.priceQ` y mapear interval:

```typescript
const checkoutInterval = variant.recurrenteInterval ?? 'monthly';
// ...
amount: variant.priceQ,
currency: 'GTQ',
description: variant.label,
interval: checkoutInterval,
metadata: {
    ...metadata,
    plan_code: 'PRO',
    variant_code: variant.code,
    one_time: String(variant.isOneTime),
},
```

> Si `variant.isOneTime`, el ítem se cobra una sola vez. Recurrente API permite `is_subscription: false`. Ampliar `CreateCheckoutParams` en el cliente.

- [ ] **Step 4: Ampliar `src/lib/recurrente/client.ts`**

En la interfaz `CreateCheckoutParams` (línea 15) añadir `oneTime?: boolean;` y en `createCheckout` mapearlo:

```typescript
body: JSON.stringify({
    items: [{
        name: params.description,
        amount_in_cents: Math.round(params.amount * 100),
        currency: params.currency,
        quantity: 1,
    }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    is_subscription: !params.oneTime,
    subscription_interval: params.oneTime ? undefined : params.interval,
    metadata: params.metadata,
}),
```

Y pasar `oneTime: variant.isOneTime` desde el route.

- [ ] **Step 5: Run unit tests + typecheck**

Run: `npx vitest run __tests__/api/create-checkout-variant.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recurrente/client.ts src/app/api/recurrente/create-checkout/route.ts __tests__/api/create-checkout-variant.test.ts
git commit -m "feat(billing): create-checkout accepts variantCode (monthly|quarterly|annual)"
```

---

## Task 6: Extender Google Play config con duración configurable

**Files:**
- Modify: `src/lib/billing/google-play-config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Leer estructura actual**

Run: `head -40 src/lib/billing/google-play-config.ts`

- [ ] **Step 2: Asegurar que la duración del pase viene de env**

En `google-play-config.ts`, asegurar que la constante usa `process.env.GOOGLE_PLAY_PASS_DURATION_DAYS` con fallback 30 — y exponer una segunda constante para el pase de 90 días:

```typescript
export function getGooglePlayPassDurationDays(): number {
    const raw = process.env.GOOGLE_PLAY_PASS_DURATION_DAYS;
    const n = raw ? Number(raw) : 30;
    return Number.isFinite(n) && n > 0 ? n : 30;
}
```

(Si la función ya existe, dejarla. Si no, añadirla y exportarla. Buscar primero antes de duplicar.)

- [ ] **Step 3: Actualizar `.env.example`**

Si no está, añadir:
```
GOOGLE_PLAY_PASS_DURATION_DAYS=90
NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS=90
GOOGLE_PLAY_PRODUCT_ID=pro_pass_90d
NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID=pro_pass_90d
```

> **No cambiar** valores en `.env.local`. El cambio en `.env.example` es plantilla.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/google-play-config.ts .env.example
git commit -m "feat(billing): make Google Play pass duration env-driven (default 90d)"
```

---

## Task 7: Reescribir copy de pricing en términos de resultado + 3 variantes

**Files:**
- Modify: `src/app/(app)/pricing/page.tsx`

> Esta tarea es **UI text + estructura**. No requiere TDD unitario, pero sí validación visual. La estrategia: reusar `PRO_VARIANTS` como source of truth.

- [ ] **Step 1: Importar el catálogo**

Al tope de `src/app/(app)/pricing/page.tsx` añadir:
```typescript
import { PRO_VARIANTS, monthlyEquivalent } from '@/lib/billing/plans';
```

- [ ] **Step 2: Reemplazar el array `PLANS` literal**

Sustituir las constantes `PLANS` (líneas ~29-82) por una construcción derivada del catálogo. Mantener `Free` como objeto literal aparte. Para PRO, mapear `PRO_VARIANTS.filter(v => v.code !== 'PRO_PASS_90D')` (el pase Android se vende solo en Android, no en pricing web).

Ejemplo del shape esperado por la UI ya existente, adaptado:

```typescript
const FREE_PLAN = {
    name: 'Free',
    code: 'FREE',
    priceLabel: 'Q0',
    description: 'Empieza a entender tus deudas y a tomar mejores decisiones cada quincena.',
    features: [/* mismas features actuales */],
};

const PRO_TIERS = PRO_VARIANTS.filter((v) => v.code !== 'PRO_PASS_90D').map((v) => ({
    code: v.code,
    name: v.label,
    priceLabel: `Q${v.priceQ}`,
    period: v.code === 'PRO_MONTHLY' ? '/mes' : v.code === 'PRO_QUARTERLY' ? 'cada 3 meses' : '/año',
    monthlyEq: `Q${monthlyEquivalent(v.code).toFixed(2)} por mes`,
    discountPct: Math.round(v.discountVsMonthly * 100),
    popular: v.code === 'PRO_QUARTERLY',
    description: v.code === 'PRO_ANNUAL'
        ? 'Para quien quiere el plan completo y olvidarse de renovar.'
        : v.code === 'PRO_QUARTERLY'
            ? 'El equilibrio entre compromiso y descuento. Ideal si tu plan es de 3+ meses.'
            : 'Para probar PRO un mes y decidir.',
}));
```

- [ ] **Step 3: Cambiar copy del hero del pricing**

En lugar del listado de 15 features, encabezar con un bloque de **resultado**:

```tsx
<div className="text-center space-y-4 pt-8">
    <Badge className="bg-primary/10 text-primary"><Crown className="mr-1 h-3 w-3" /> PRO</Badge>
    <h1 className="text-3xl sm:text-5xl font-bold">Decide cada quincena qué pagar primero, con números claros.</h1>
    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
        PRO te muestra cuánto vas a ahorrar exactamente, te avisa antes de cada pago y ajusta tu plan
        cuando cambia tu ingreso. Cancelas cuando quieras y mantienes acceso hasta que termine el período pagado.
    </p>
</div>
```

- [ ] **Step 4: Renderizar 3 columnas PRO en lugar de 1**

Reemplazar `<div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto w-full">` por `md:grid-cols-3` + `max-w-6xl`. Cada Card de PRO_TIER muestra `priceLabel`, `period`, `monthlyEq`, `discountPct` (cuando > 0) y un solo CTA `Link href={\`/checkout?variant=${tier.code}\`}`.

- [ ] **Step 5: Eliminar duplicación de features**

Mover el listado de "qué incluye PRO" a un solo bloque debajo de las 3 columnas: "Todas las variantes incluyen". Esto evita que el usuario crea que las features cambian por variante.

- [ ] **Step 6: Validar build + acceso manual**

Run: `npm run dev` y abrir [http://localhost:3000/pricing](http://localhost:3000/pricing). Verificar:
- 3 cards PRO visibles
- "Más popular" sobre `PRO_QUARTERLY`
- `PRO_ANNUAL` muestra "32% descuento"
- `Q33.25 por mes` aparece debajo del precio anual

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/pricing/page.tsx
git commit -m "feat(pricing): show 3 PRO variants with monthly equivalent and result-led copy"
```

---

## Task 8: Bajar claims sin sustento del landing

**Files:**
- Modify: `src/components/landing/hero.tsx`
- Modify: `src/components/landing/features.tsx`
- Modify: `src/components/landing/cta-section.tsx`

> **Por qué importa:** el análisis chairman flagged "95% satisfacción" y "30% ahorro en intereses" como claims sin evidencia. Mantenerlos en una app financiera = riesgo regulatorio + daño de credibilidad. **Eliminar > reemplazar con genéricos**.

- [ ] **Step 1: Buscar claims**

Run: `grep -n "95%\|30%\|mejor app\|los mejores\|garantizado" src/components/landing/`
Expected: lista de líneas concretas.

- [ ] **Step 2: Reemplazar por copy verificable**

Patrón: cualquier número de éxito o superlativo sin fuente → reemplazar por descripción **del proceso**.

Ejemplo:
- Antes: "Ahorras hasta 30% en intereses"
- Después: "Te mostramos cuánto pagarías de interés con tu plan actual y con cada estrategia, para que decidas con números claros."

- Antes: "95% de usuarios satisfechos"
- Después: eliminar.

- Antes: "La mejor app para salir de deudas en Guatemala"
- Después: "Una ruta clara para ordenar tus deudas en Guatemala."

- [ ] **Step 3: Validar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/hero.tsx src/components/landing/features.tsx src/components/landing/cta-section.tsx
git commit -m "chore(landing): replace unsupported claims with verifiable copy"
```

---

## Task 9: Tests del flujo de variantes (E2E)

**Files:**
- Create: `e2e/pricing-variants.spec.ts`

- [ ] **Step 1: Test E2E**

Crear `e2e/pricing-variants.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Pricing variants', () => {
    test('renders 3 PRO tiers with distinct prices', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByText('Q49')).toBeVisible();
        await expect(page.getByText('Q119')).toBeVisible();
        await expect(page.getByText('Q399')).toBeVisible();
    });

    test('annual tier shows monthly equivalent', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByText(/Q33\.\d+ por mes/)).toBeVisible();
    });
});
```

- [ ] **Step 2: Run E2E**

Run: `npm run dev &  ; npx playwright test e2e/pricing-variants.spec.ts`
Expected: PASS 2/2.

- [ ] **Step 3: Commit**

```bash
git add e2e/pricing-variants.spec.ts
git commit -m "test(e2e): pricing renders 3 PRO variants with monthly equivalent"
```

---

## Task 10: Migration — `manual_payment_grants` para auditoría de activaciones manuales

**Files:**
- Create: `supabase/migrations/038_manual_payment_grants.sql`

- [ ] **Step 1: Crear migration**

```sql
-- 038_manual_payment_grants.sql
CREATE TABLE IF NOT EXISTS public.manual_payment_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    granted_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id),
    variant_code VARCHAR(32) NOT NULL,
    price_amount_q NUMERIC(10, 2) NOT NULL,
    bank_reference VARCHAR(120),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0 AND duration_days <= 400),
    expires_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_payment_grants_tenant ON public.manual_payment_grants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manual_payment_grants_expires ON public.manual_payment_grants(expires_at);

ALTER TABLE public.manual_payment_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_manual_grants" ON public.manual_payment_grants;
CREATE POLICY "service_role_only_manual_grants"
    ON public.manual_payment_grants
    FOR ALL
    USING (false)
    WITH CHECK (false);

COMMENT ON TABLE public.manual_payment_grants IS 'Auditoría de activaciones manuales (transferencia bancaria, deposito, admin grant).';
```

- [ ] **Step 2: Aplicar y regenerar tipos**

Run: `npm run db:push:local && npx supabase gen types typescript --local > src/types/supabase.ts`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/038_manual_payment_grants.sql src/types/supabase.ts
git commit -m "feat(db): add manual_payment_grants audit table"
```

---

## Task 11: Server action `adminGrantManualSubscription`

**Files:**
- Create: `src/lib/actions/admin-billing.ts`
- Test: `__tests__/admin/admin-billing.test.ts`

- [ ] **Step 1: Test que falla — dispara cuando admin role no autorizado**

```typescript
import { describe, it, expect, vi } from 'vitest';

const requireAdminMock = vi.fn();
vi.mock('@/lib/actions/admin-auth', () => ({
    requireAdminSession: requireAdminMock,
}));

describe('adminGrantManualSubscription', () => {
    it('throws when admin auth fails', async () => {
        requireAdminMock.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        await expect(
            adminGrantManualSubscription({
                tenantId: '00000000-0000-0000-0000-000000000000',
                variantCode: 'PRO_QUARTERLY',
                bankReference: 'BI-12345',
                notes: null,
            })
        ).rejects.toThrow('UNAUTHORIZED');
    });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run __tests__/admin/admin-billing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear `src/lib/actions/admin-billing.ts`:

```typescript
'use server';

import { z } from 'zod';
import { requireAdminSession } from '@/lib/actions/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getProVariant, type ProVariantCode } from '@/lib/billing/plans';
import { recordMarketingEventWithAdmin } from '@/lib/funnel/events';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { logPaymentEvent } from '@/lib/logger';

const Input = z.object({
    tenantId: z.string().uuid(),
    variantCode: z.enum(['PRO_MONTHLY', 'PRO_QUARTERLY', 'PRO_ANNUAL']),
    bankReference: z.string().min(3).max(120),
    notes: z.string().max(2000).nullable(),
});

export async function adminGrantManualSubscription(raw: z.infer<typeof Input>) {
    const session = await requireAdminSession();
    const data = Input.parse(raw);
    const variant = getProVariant(data.variantCode as ProVariantCode);

    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + variant.durationDays * 24 * 60 * 60 * 1000);

    const { error: grantError } = await admin
        .from('manual_payment_grants')
        .insert({
            tenant_id: data.tenantId,
            granted_by_admin_id: session.adminId,
            variant_code: variant.code,
            price_amount_q: variant.priceQ,
            duration_days: variant.durationDays,
            bank_reference: data.bankReference,
            expires_at: expiresAt.toISOString(),
            notes: data.notes,
        });
    if (grantError) throw grantError;

    const { error: subError } = await admin
        .from('subscriptions')
        .upsert(
            {
                tenant_id: data.tenantId,
                plan_code: 'PRO',
                status: 'ACTIVE',
                billing_interval: variant.code === 'PRO_QUARTERLY' ? 'quarterly' : variant.code === 'PRO_ANNUAL' ? 'yearly' : 'monthly',
                price_amount_q: variant.priceQ,
                payment_method: 'manual_transfer',
                renew_at: expiresAt.toISOString(),
            },
            { onConflict: 'tenant_id' }
        );
    if (subError) throw subError;

    await recordMarketingEventWithAdmin(
        admin,
        {
            eventName: 'subscription_activated',
            tenantId: data.tenantId,
            metadata: {
                source: 'manual_transfer',
                variantCode: variant.code,
                bankReference: data.bankReference,
            },
        },
        createMarketingContext(null, undefined)
    );

    logPaymentEvent({
        event: 'manual_grant',
        tenantId: data.tenantId,
        adminId: session.adminId,
        variantCode: variant.code,
        priceQ: variant.priceQ,
    });

    return { ok: true, expiresAt: expiresAt.toISOString() };
}
```

> **Verificar:** `requireAdminSession` retorna `{ adminId }` y `logPaymentEvent` acepta los campos arriba. Si la firma real difiere, ajustar al firma existente — **no inventar APIs nuevas**.

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run __tests__/admin/admin-billing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-billing.ts __tests__/admin/admin-billing.test.ts
git commit -m "feat(admin): adminGrantManualSubscription with audit trail"
```

---

## Task 12: UI admin — formulario de activación manual

**Files:**
- Create: `src/app/admin/customers/[tenantId]/billing/page.tsx`

> Si la ruta `src/app/admin/customers/[tenantId]/` ya existe con otra forma, **adaptar** en vez de duplicar. Ejecutar `ls src/app/admin/customers/` antes de crear.

- [ ] **Step 1: Componente formulario**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { adminGrantManualSubscription } from '@/lib/actions/admin-billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function AdminGrantClient({ tenantId }: { tenantId: string }) {
    const [variantCode, setVariantCode] = useState<'PRO_MONTHLY' | 'PRO_QUARTERLY' | 'PRO_ANNUAL'>('PRO_QUARTERLY');
    const [bankReference, setBankReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isPending, startTransition] = useTransition();

    const submit = () =>
        startTransition(async () => {
            try {
                const r = await adminGrantManualSubscription({
                    tenantId,
                    variantCode,
                    bankReference,
                    notes: notes || null,
                });
                toast.success(`PRO activo hasta ${new Date(r.expiresAt).toLocaleDateString('es-GT')}`);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error');
            }
        });

    return (
        <div className="space-y-4 max-w-md">
            <Select value={variantCode} onValueChange={(v) => setVariantCode(v as typeof variantCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="PRO_MONTHLY">Mensual (Q49 / 30 días)</SelectItem>
                    <SelectItem value="PRO_QUARTERLY">Trimestral (Q119 / 90 días)</SelectItem>
                    <SelectItem value="PRO_ANNUAL">Anual (Q399 / 365 días)</SelectItem>
                </SelectContent>
            </Select>
            <Input placeholder="Referencia bancaria (ej. BI-12345)" value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
            <Input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button disabled={isPending || !bankReference} onClick={submit}>
                {isPending ? 'Activando...' : 'Activar PRO manual'}
            </Button>
        </div>
    );
}
```

(Server component que envuelve este client component recibe `params: { tenantId }` y lo pasa.)

- [ ] **Step 2: Validar typecheck + ejecutar manualmente con admin local**

Run: `npm run typecheck && npm run dev`
Login admin (`admin@rutacero.gt` / `Admin123!`) → ir a la URL → activar.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/customers/[tenantId]/billing/
git commit -m "feat(admin): UI to grant PRO manually after bank transfer"
```

---

## Task 13: Endpoint `/api/billing/manual-transfer` + email de instrucciones

**Files:**
- Create: `src/app/api/billing/manual-transfer/route.ts`
- Create: `src/lib/emails/transfer-instructions.tsx`
- Modify: `.env.example` (`BANK_TRANSFER_INSTRUCTIONS_JSON`)

- [ ] **Step 1: Email template**

```tsx
// src/lib/emails/transfer-instructions.tsx
import { Html, Body, Container, Heading, Text, Section } from '@react-email/components';

export interface TransferInstructionsProps {
    variantLabel: string;
    priceQ: number;
    accounts: Array<{ bank: string; accountType: string; accountNumber: string; accountName: string }>;
    referenceCode: string;
}

export default function TransferInstructions({ variantLabel, priceQ, accounts, referenceCode }: TransferInstructionsProps) {
    return (
        <Html>
            <Body>
                <Container>
                    <Heading>Instrucciones de pago — {variantLabel}</Heading>
                    <Text>Monto a depositar: <strong>Q{priceQ.toFixed(2)}</strong></Text>
                    <Text>Código de referencia (incluirlo en la transferencia): <strong>{referenceCode}</strong></Text>
                    {accounts.map((a, i) => (
                        <Section key={i}>
                            <Text><strong>{a.bank}</strong> — {a.accountType}</Text>
                            <Text>Cuenta: {a.accountNumber}</Text>
                            <Text>A nombre de: {a.accountName}</Text>
                        </Section>
                    ))}
                    <Text>Envía el comprobante respondiendo a este correo o desde la app, en Soporte. Activamos tu PRO en menos de 24 horas hábiles.</Text>
                </Container>
            </Body>
        </Html>
    );
}
```

- [ ] **Step 2: Endpoint que envía el email + registra evento**

```typescript
// src/app/api/billing/manual-transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserTenant } from '@/lib/tenant/server';
import { getProVariant } from '@/lib/billing/plans';
import { recordMarketingEvent } from '@/lib/funnel/events';
import { sendTransferInstructionsEmail } from '@/lib/resend/transfer';
import { applyRateLimit, getClientIdentifier, rateLimitExceededResponse } from '@/lib/rate-limit';

const Body = z.object({
    variantCode: z.enum(['PRO_MONTHLY', 'PRO_QUARTERLY', 'PRO_ANNUAL']),
});

export async function POST(req: NextRequest) {
    const id = getClientIdentifier(req);
    const { success } = await applyRateLimit(id, 'checkout');
    if (!success) return rateLimitExceededResponse();

    const { user, tenantId } = await requireUserTenant();
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });

    const variant = getProVariant(parsed.data.variantCode);
    const referenceCode = `RC-${tenantId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    await sendTransferInstructionsEmail({
        to: user.email!,
        variant,
        referenceCode,
    });

    await recordMarketingEvent({
        eventName: 'checkout_started',
        tenantId,
        userId: user.id,
        metadata: { method: 'manual_transfer', variantCode: variant.code, referenceCode },
    });

    return NextResponse.json({ ok: true, referenceCode });
}
```

> **Crear `src/lib/resend/transfer.ts`** con `sendTransferInstructionsEmail` que lee `BANK_TRANSFER_INSTRUCTIONS_JSON` de env y usa Resend (ya configurado en el proyecto).

- [ ] **Step 3: Validar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billing/manual-transfer/ src/lib/emails/transfer-instructions.tsx src/lib/resend/transfer.ts .env.example
git commit -m "feat(billing): manual-transfer endpoint emits Resend email with reference code"
```

---

## Task 14: Página `/pago-manual` con CTA por variante

**Files:**
- Create: `src/app/(public)/pago-manual/page.tsx` (o `(app)` si requiere login)

- [ ] **Step 1: Página simple con 3 botones que llaman al endpoint**

Componente client minimal que para cada variante hace `fetch('/api/billing/manual-transfer', { method: 'POST', body: JSON.stringify({ variantCode }) })` y muestra el `referenceCode` retornado + un mensaje "Te enviamos los datos al correo".

- [ ] **Step 2: Enlazar desde `/pricing`**

En `src/app/(app)/pricing/page.tsx`, debajo de las 3 cards PRO, añadir:

```tsx
<div className="rounded-xl border bg-muted/30 p-4 text-center">
    <p className="text-sm">¿No tienes tarjeta? Puedes pagar por <Link className="underline" href="/pago-manual">transferencia bancaria</Link>.</p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/pago-manual/ src/app/\(app\)/pricing/page.tsx
git commit -m "feat(pricing): expose manual transfer payment option"
```

---

## Task 15: E2E del flujo completo de pago manual

**Files:**
- Create: `e2e/manual-transfer.spec.ts`

- [ ] **Step 1: Test E2E (mock Resend en test env)**

```typescript
import { test, expect } from '@playwright/test';

test('manual transfer flow yields a reference code', async ({ page }) => {
    await page.goto('/login');
    // helpers de login existentes en e2e/login.spec.ts
    // ...
    await page.goto('/pago-manual');
    await page.getByRole('button', { name: /trimestral/i }).click();
    await expect(page.getByText(/RC-[A-Z0-9-]+/)).toBeVisible();
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test e2e/manual-transfer.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/manual-transfer.spec.ts
git commit -m "test(e2e): manual transfer flow generates reference code"
```

---

## Verification Pass (al terminar Task 15)

Antes de declarar Fases 0-2 completadas, correr:

```bash
npm run check
```

Expected:
- `lint` PASS
- `typecheck` PASS
- `test:run` PASS (≥ los nuevos tests añadidos)
- `test:e2e:critical` PASS
- `build` PASS

Si alguno falla, **no avanzar** a sub-plans. Diagnosticar con `superpowers:systematic-debugging`.

---

## Sub-plans para Fases 3-5 (specs cortos para futuros plans)

Estas fases requieren su propio plan TDD detallado. Las dejo como **specs ejecutables** que un futuro plan expandirá:

### Sub-plan A — Onboarding con captura de intención (Fase 3)

**Goal:** capturar objetivo, tolerancia a riesgo y método de pago preferido durante el onboarding, para personalizar el plan y la propuesta de upgrade.

**Tablas tocadas:** `user_profiles` (añadir `primary_goal`, `risk_tolerance`, `preferred_payment_method` — ya hay infra de "personalization" en `028_debt_modeling_and_personalization.sql`, posible duplicado: revisar primero).

**Endpoints/UI:** modificar el wizard de onboarding (buscar `src/app/(auth)/onboarding/` o equivalente) para añadir 2-3 pasos. Persistir en `user_profiles` y leer desde el motor de planes (`src/lib/engine/`) para ponderar estrategia.

**Tests:** unit del motor con cada combinación de inputs; E2E que verifica que el plan generado cambia con `primary_goal=FASTEST` vs `LEAST_INTEREST`.

**Costo terceros:** 0.

### Sub-plan B — Dashboard B2B2C de partners + página `/empresas` (Fase 4)

**Goal:** generar pitch material y dashboard agregado anonimizado por partner, explotando la infraestructura de `/partners/[partnerSlug]` y los eventos de funnel ya capturados.

**Páginas nuevas:**
- `/empresas` — landing para vender el producto a empleadores y cooperativas. Estática, ~300 líneas, sin nuevas APIs.
- `/admin/partners/[slug]` — dashboard agregado: usuarios activados por partner, deuda total declarada (anonimizada en buckets), conversión PRO. Lee de `marketing_funnel_events` filtrando por `partnerSlug`.

**Endpoints:** ninguno nuevo. Reusar `recordMarketingEvent` que ya recibe `landingVariant`/`offerVariant`/partner.

**Costo terceros:** 0. El pitch comercial es trabajo manual fuera del repo.

### Sub-plan C — Recordatorios premium WhatsApp + asesoría humana (Fase 5)

**Goal:** monetizar canal WhatsApp (recordatorios premium Q19/mes addon) y producto one-shot "Asesoría humana 30 min Q299".

**WhatsApp (free tier):**
- Crear app en [Meta for Developers](https://developers.facebook.com/) (gratis), configurar WhatsApp Cloud API.
- Tabla nueva `whatsapp_optins` para opt-in y verificación del número.
- Cron diario que lee deudas con `payment_day` próximo y envía plantilla aprobada.
- Free tier Meta: 1000 service conversations/mes (incluye user-initiated). Para nuestra escala inicial es suficiente.

**Asesoría 1-a-1:**
- Crear variante de producto `ADVISORY_30M` con `priceQ: 299`, `isOneTime: true`, registrada en `PRO_VARIANTS` (o catálogo separado `ADVISORY_VARIANTS`).
- Página `/asesoria` con formulario + integración con [Cal.com](https://cal.com) (free self-host o free tier hosted) por embed.
- Después del checkout exitoso, se envía link de Cal.com al usuario por email.

**Costo terceros:** 0 mientras quepamos en free tiers (WhatsApp 1k/mes, Cal.com hosted free tier).

---

## Self-Review (resultados)

**1. Spec coverage:**
- Observabilidad → T1 (Sentry), T2 (funnel propio).
- Reposicionamiento oferta → T3 (DB), T4 (catálogo), T5 (checkout), T6 (Android), T7 (UI), T8 (claims), T9 (E2E).
- Pago transferencia → T10 (DB), T11 (action), T12 (UI admin), T13 (endpoint+email), T14 (página), T15 (E2E).
- Fases 3-5 → sub-plans A, B, C.

**2. Placeholder scan:**
- Cero "TBD/TODO".
- Tareas que tocan funciones de infra existente (`requireAdminSession`, `recordMarketingEventWithAdmin`, `logPaymentEvent`, `sendTransferInstructionsEmail`) explican que el ejecutor verifique la firma real antes de inventar.

**3. Type consistency:**
- `ProVariantCode` definido en T4 y reusado consistentemente en T5, T11, T12.
- `billing_interval` enum SQL alineado con `PRO_VARIANTS` (`monthly|quarterly|yearly|pass_30d|pass_90d`).
- Manual grant siempre usa `payment_method='manual_transfer'`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-09-rutacero-monetizacion.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Despacho un subagente fresco por task, con review entre tasks usando `superpowers:subagent-driven-development`. Ideal para tasks T1-T15 que son independientes.

**2. Inline Execution** — Ejecutar tasks en esta sesión con `superpowers:executing-plans`, batch con checkpoints.

**¿Cuál prefieres?**
