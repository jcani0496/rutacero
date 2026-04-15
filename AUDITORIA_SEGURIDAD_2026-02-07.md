# Auditoria de Seguridad (RutaCero)

Fecha: 2026-02-07  
Proyecto: `/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app`  
Stack: Next.js, React, Supabase (Postgres + Auth + RLS), Recurrente (pagos), Resend (emails), Upstash (rate limit opcional)

## 1. Resumen ejecutivo
El aplicativo ahora es **multi-tenant (workspaces)**. El tenant activo se resuelve por `user_profiles.current_tenant_id`, y la data core se aisla por `tenant_id` + `user_id` con RLS. La superficie de ataque principal es:

- Next.js (SSR/Server Actions/API Routes)
- Supabase (RLS, funciones `SECURITY DEFINER`, tablas admin en `public`)
- Webhooks de Recurrente
- Cron endpoints
- Panel Admin con sesion propia (`admin_session` cookie)

Se detectaron **riesgos criticos** de seguridad relacionados con:

- **Sembrado de credenciales admin** conocidas en una migracion.
- **Funcion RPC `SECURITY DEFINER`** que permite **impersonacion** si el `user_id` es controlado por el cliente.
- **Politicas RLS incorrectas** que permiten inserciones arbitrarias (notificaciones).
- Posible **exposicion accidental** de tablas admin/sistema si existen GRANTs amplios (patron comun en Supabase cuando RLS no esta habilitado).

Tambien se detectaron temas de hardening (CSP permisivo en prod, docs con CORS `*`, idempotencia de webhooks, uso de service role en middleware).

Estado: Las remediaciones descritas abajo fueron **implementadas en este repo** y aplicadas a Supabase local via migraciones (Docker + Supabase local, sin prod).

## 2. Hallazgos (priorizados)

### [CRITICO] Credenciales admin sembradas en migracion
Evidencia: `supabase/migrations/003_admin_tables.sql` inserta un `admin@rutacero.gt` con password conocido (comentado) y hash fijo.

Impacto:
- Si esto llega a un entorno publico sin rotacion inmediata, un atacante puede entrar al panel admin.
- Consecuencias: exfiltracion de datos, manipular reportes/soporte, operaciones privilegiadas, fraude operacional.

Accion:
- Eliminar el seed del super admin de migraciones para cualquier entorno no-local.
- Rotar/forzar cambio de password de admins existentes.
- Agregar rate limiting + monitoreo de intentos a login admin.

### [CRITICO] Privilege escalation/impersonacion en RPC `create_payment_atomic`
Evidencia: `supabase/migrations/007_create_payment_atomic_function.sql` define `create_payment_atomic(p_user_id, ...)` como `SECURITY DEFINER` y **no valida** que `p_user_id = auth.uid()`. Se otorga `GRANT EXECUTE ... TO authenticated`.

Impacto:
- Si un atacante obtiene/infiera `debt_id` de otro usuario, puede intentar ejecutar el RPC pasando `p_user_id` del owner y modificar estado/insertar pagos, porque la funcion corre con privilegios elevados.

Accion:
- Enforzar `p_user_id = auth.uid()` (o eliminar el parametro y usar `auth.uid()` directamente).
- Validar `amount > 0`, currency permitida, fecha valida.

Estado en repo:
- Se agrego migracion correctiva: `supabase/migrations/022_security_hardening.sql`.
- Se removio el RPC legado que aceptaba `p_user_id` (reduce superficie de ataque): `supabase/migrations/027_drop_create_payment_atomic_v1.sql`.

### [CRITICO] RLS mal configurado permite inserciones arbitrarias (notificaciones)
Evidencia:
- `supabase/migrations/016_user_notifications.sql`:
  - Policy: `"Service role can insert notifications" ... WITH CHECK (true)`
- `supabase/migrations/004_admin_notifications.sql`:
  - Policy: `"Service role can insert notifications" ... WITH CHECK (true)`

Impacto:
- Cualquier rol con privilegio de `INSERT` (frecuente para `authenticated` en Supabase) podria insertar notificaciones:
  - Para si mismo o para otros usuarios/admins.
  - Spam, ruido operacional, potencial phishing/social engineering.

Accion:
- Cambiar `WITH CHECK (true)` por `WITH CHECK (auth.role() = 'service_role')`.

Estado en repo:
- Se agrega fix en `supabase/migrations/022_security_hardening.sql`.

### [ALTO] Tablas sensibles admin/sistema sin RLS
Evidencia:
- En `supabase/migrations/001_initial_schema.sql` y `supabase/migrations/003_admin_tables.sql` hay tablas que (segun migracion) quedan sin RLS o con acceso implicito:
  - `admin_users`, `audit_logs`, `payment_webhook_events`, `engine_configs`, `feature_flags`

Riesgo:
- En Supabase, si existen GRANTs a `anon/authenticated` (patron comun), **sin RLS** estas tablas se vuelven consultables/modificables via PostgREST usando el ANON KEY.
- `admin_users` es especialmente sensible: contiene `password_hash`.

Accion:
- Habilitar RLS en tablas sensibles.
- Usar `service_role` solo desde server para operaciones admin.
- Revisar/ajustar GRANTs en el proyecto Supabase (ideal: principio de minimo privilegio).

Estado en repo:
- Se habilita RLS en tablas sensibles en `supabase/migrations/022_security_hardening.sql`.
- `src/lib/actions/admin-auth.ts` fue ajustado para usar service role en operaciones sobre `admin_users` y `audit_logs`.

### [ALTO] Vulnerabilidades reportadas en Next.js (dependencias)
Evidencia:
- `npm audit --omit=dev` reportaba vulnerabilidad HIGH para `next@16.1.1`.

Accion:
- Actualizar Next a version parchada.

Estado en repo:
- `next` y `eslint-config-next` se actualizaron a `16.1.6`.
- `npm audit --omit=dev` ahora indica `0 vulnerabilities`.

### [ALTO] CSP permisivo en produccion (`unsafe-eval`/`unsafe-inline`)
Evidencia: `next.config.ts`
- `script-src 'self' 'unsafe-eval' 'unsafe-inline'`

Impacto:
- Reduce significativamente la efectividad del CSP ante XSS. En caso de una inyeccion, el navegador tendra menos barreras.

Accion (recomendada por fases):
- Fase 1: remover `'unsafe-eval'` en prod (si es posible) y medir.
- Fase 2: migrar a CSP con nonce/hashes para scripts inline de Next (`strict-dynamic` si aplica).

### [MEDIO] Webhooks no idempotentes (tabla `payment_webhook_events` sin uso)
Evidencia:
- `supabase/migrations/001_initial_schema.sql` crea `payment_webhook_events`.
- `src/app/api/webhooks/recurrente/route.ts` no inserta/valida contra esa tabla antes de procesar.

Impacto:
- Reintentos/dobles entregas pueden generar estados inconsistentes o “upserts” repetidos.

Accion:
- Insertar el evento (provider + external_event_id) al inicio y si ya existe, salir (200 OK).
- Marcar `processed=true` solo al completar.

### [MEDIO] `/api/docs` expone OpenAPI con CORS `*`
Evidencia: `src/app/api/docs/route.ts` agrega `Access-Control-Allow-Origin: *`.

Impacto:
- Permite que cualquier sitio consuma el spec desde el navegador (inventario de endpoints).

Accion:
- Restringir CORS a tu dominio o proteger con auth/feature flag (al menos en prod).

### [MEDIO] Uso de service-role en middleware
Evidencia: `src/lib/supabase/middleware.ts` usa `SUPABASE_SERVICE_ROLE_KEY` para actualizar `last_active_at`.

Riesgo:
- Exposicion accidental por errores/logs en edge runtime.
- Costo/perf: llamadas frecuentes a DB en middleware.

Accion:
- Mover tracking de actividad a:
  - Server Action post-login, o
  - Job batch (cron) agregando ultima actividad, o
  - Trigger DB seguro.

## 3. Plan de accion (recomendado)

### 0-2 dias (bloqueo de riesgos criticos)
- Validar que en Supabase PROD no exista el usuario `admin@rutacero.gt` con password default; si existe, deshabilitar/rotar inmediatamente.
- Aplicar `supabase/migrations/022_security_hardening.sql` en tu proyecto Supabase (o replicar manualmente en SQL editor).
- Revisar GRANTs/privilegios en Supabase para `public` schema.
- Actualizar despliegue con `next@16.1.6` (ya actualizado en repo).

### Implementado (en este repo/local)
- Seed admin default removido de migraciones y admin legacy desactivado:
  - `supabase/migrations/003_admin_tables.sql`
  - `supabase/migrations/023_security_cleanup.sql`
- RLS hardening y policies service_role-only para inserciones sensibles:
  - `supabase/migrations/022_security_hardening.sql`
- Webhook idempotente + registro de eventos:
  - `src/app/api/webhooks/recurrente/route.ts`
- CSP/CORS hardening:
  - `next.config.ts`
  - `src/app/api/docs/route.ts`
- Service role removido del middleware (tracking de actividad bajo RLS):
  - `src/lib/supabase/middleware.ts`

### Multi-tenant (impacto en seguridad)
- Aislamiento por workspace (tenant):
  - `supabase/migrations/024_multi_tenant_workspace.sql`
  - `supabase/migrations/026_tenants_id_default.sql`
  - `src/lib/tenant/server.ts`

### 1-2 semanas (hardening y resiliencia)
- Implementar idempotencia de webhooks usando `payment_webhook_events`.
- Endurecer CSP (remover `unsafe-eval` en prod, y plan para nonces).
- Restringir `/api/docs` (CORS + auth/feature flag).
- Refactor para remover service role del middleware.

### 2-6 semanas (madurez)
- Pruebas automatizadas:
  - RLS tests: “usuario A no ve datos de usuario B”, y luego version multi-tenant.
  - Webhook replay tests.
- Observabilidad:
  - Alarmas por intentos fallidos admin login.
  - Alarmas por firma webhook invalida.
