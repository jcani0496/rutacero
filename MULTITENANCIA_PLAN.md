# Multi-tenancy (Workspaces) - Implementado

Fecha: 2026-02-07  
Proyecto: `/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app`

## 1. Requisitos (confirmados)
- Tenant por **workspace seleccionado**.
- **Billing por tenant**.
- La data es **personal**: no se comparte entre miembros (no hay data "del tenant" compartida).

## 2. Estado actual (implementado)
Se implemento multi-tenancy via `tenant_id` en tablas core + `user_profiles.current_tenant_id` como "tenant activo".

Archivos principales:
- DB: `supabase/migrations/024_multi_tenant_workspace.sql`
- DB: `supabase/migrations/026_tenants_id_default.sql` (permite insertar tenants sin pasar `id`)
- App: `src/lib/tenant/server.ts` (`requireUserTenant`, `ensureCurrentTenantForUser`)
- UI: `src/app/(app)/workspaces/page.tsx`

## 3. Resolucion de tenant (workspace seleccionado)
- `user_profiles.current_tenant_id` define el workspace activo.
- La app resuelve el tenant via `requireUserTenant()` y filtra las consultas por `.eq('tenant_id', tenantId)`.
- `ensureCurrentTenantForUser(userId)` crea automaticamente el "Personal" tenant + membership + subscription FREE si faltan.

## 4. Billing por tenant
- `subscriptions.tenant_id` es unico (1 subscription activa por tenant).
- `invoices.tenant_id` tambien es por tenant.
- Los endpoints de Recurrente usan metadata con `tenant_id` + `purchaser_user_id`.
- Webhook upserta por `tenant_id`.

## 5. Data personal (no compartida)
RLS en tablas core requiere:
- `user_id = auth.uid()`
- membership en `tenant_memberships` para ese `tenant_id`

Nota:
- Aunque existen `tenant_memberships`, actualmente no hay flujo de invitaciones para compartir data. Aun si se agregaran miembros, la data core seguiria siendo personal por `user_id`.

## 6. Como probar aislamiento (local)
1. Entra a `/workspaces`.
2. Crea un workspace nuevo.
3. Crea una deuda/pago en ese workspace.
4. Cambia al workspace anterior.
5. Verifica que la deuda/pago no aparece (porque `tenant_id` cambia).

## 7. Nota tecnica (por que esto es seguro)
- El tenant activo se persiste en DB (`user_profiles.current_tenant_id`).
- La app filtra por `tenant_id` y RLS evita accesos fuera de `auth.uid()`/membership.
- Billing (subscriptions/invoices) queda ligado al tenant para evitar cobros cruzados.
