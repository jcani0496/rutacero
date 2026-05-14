# RutaCero — Launch Readiness Checklist

Operacional. Dueño: founder técnico (jcani0496). Esta es la checklist única
para pasar de "código completo" a "usuarios reales en producción". Consolida
la información que está distribuida entre los demás runbooks operacionales;
todo lo que aquí se menciona de forma resumida tiene su detalle en alguno de
los archivos listados en la sección 5.

Convención de estado en checklist:

- ✅ hecho y verificado.
- ⚠️ parcialmente listo o bloqueado por dependencia externa.
- ❌ pendiente.

## 0. Estado actual (snapshot)

Fecha del snapshot: 2026-05-12.

| Área | Estado | Notas |
|------|--------|-------|
| Phases E (T23–T25) | ✅ | Mergeadas a `main`. |
| Phases G (T30–T32) | ✅ | Mergeadas a `main`. |
| Phases H (T33–T35) | ✅ | Mergeadas a `main`. |
| Sentry SDK pattern moderno | ✅ | `instrumentation-client.ts` en `src/`, eventos llegando a producción. |
| Sentry env vars en Vercel | ✅ | 4/4 (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`). |
| Storage bucket `payment-receipts` | ✅ | Provisionado en Supabase Studio; ver `storage-buckets.md`. |
| Reglas de alerta Sentry | ✅ | 4/4 aplicadas; ver `src/lib/observability/sentry-alerts.md`. |
| Auth token Sentry rotado post-exposure | ✅ | Token nuevo en Vercel; el anterior está revocado. |
| Phase F WhatsApp (T26–T29) | ⚠️ | Bloqueado en Meta Business + aprobación de plantillas. |
| Phase H T34 SPF/DKIM | ⚠️ | Bloqueado en compra de dominio. Detalle: `email-domain.md`. |
| Phase I T36 smoke test funnel completo | ⚠️ | Bloqueado en device Android físico. |
| Phase G native camera | ⚠️ | Código listo en JS; falta `npx cap sync android` + verificación en device. |
| Dominio comprado | ❌ | Sin esto, emails siguen saliendo de `onboarding@resend.dev`. |
| FEL certificador integrado | ⚠️ | Operación manual hasta el primer cobro; ver `fel-emission-policy.md`. |

## 1. Pre-launch (lo que debe estar verde antes de publicar)

### 1.1 Infraestructura

- [ ] Supabase project **activo** y NO suspendido. Supabase suspende proyectos
      free después de 7 días sin actividad; si está suspendido, ver sección 4
      ("Caso: Supabase suspendido").
- [ ] Vercel project conectado al repo GitHub `jcani0496/<repo>`.
- [ ] Vercel auto-deploy desde `main` funcionando. **NOTA:** hemos visto
      flakiness del webhook GitHub→Vercel durante este ciclo; si un merge a
      `main` no dispara deploy, ver sección 4 ("Caso: Vercel webhook…").
- [ ] Storage bucket `payment-receipts` provisionado con policies INSERT y
      SELECT scoped a `auth.uid()`. SQL canónico en `storage-buckets.md`.
      NO debe existir policy DELETE de usuario.
- [ ] Migrations 001–046 aplicadas en producción (ver §1.3 para cómo verificar).
- [ ] Dominio comprado y DNS configurado. Candidato actual: `rutacero.app`.
      Detalle del flujo en `email-domain.md` §2.
- [ ] DNS apuntado a Cloudflare (recomendado) o equivalente; SPF + DKIM
      verificados en Resend (`email-domain.md` §4).

### 1.2 Configuración de entornos (env vars)

Las vars de Vercel se setean en **production** y **preview** por separado.
Producción es la única que necesita estar 100% verde para launch; preview
puede vivir con mocks (`RECURRENTE_MOCK_MODE=true`, etc.).

#### Supabase

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | falta | En Vercel se setea explícito; sin esto el browser client no resuelve. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | falta | Pública por diseño (RLS protege). |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | falta | **Secret.** Nunca exponer al navegador. |

#### App

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `NEXT_PUBLIC_APP_URL` | Sí | falta | URL canónica (dominio comprado). Hasta que exista, usar el alias `rutacero.vercel.app`. |

#### Recurrente

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `RECURRENTE_MOCK_MODE` | Sí | `false` en prod | En prod debe ser `false` o quedar sin setear. |
| `RECURRENTE_PUBLIC_KEY` | Sí | falta | |
| `RECURRENTE_API_KEY` | Sí | falta | Compat con configs viejas; mismo valor que `PUBLIC_KEY`. |
| `RECURRENTE_SECRET_KEY` | Sí | falta | **Secret.** |
| `RECURRENTE_WEBHOOK_SECRET` | Sí | falta | **Secret.** Mínimo 32 chars. Tomarlo de Recurrente → Webhooks → Signing Secret. |

#### Google Play Billing

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `GOOGLE_PLAY_MOCK_MODE` | Sí | `false` en prod | |
| `GOOGLE_PLAY_PACKAGE_NAME` | Sí | falta | `com.rutacero.app`. |
| `GOOGLE_PLAY_PRODUCT_ID` | Sí | falta | `pro_pass_30d` por defecto. |
| `NEXT_PUBLIC_GOOGLE_PLAY_PACKAGE_NAME` | Sí | falta | Debe coincidir con el server. |
| `NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID` | Sí | falta | Debe coincidir con el server. |
| `GOOGLE_PLAY_PASS_DURATION_DAYS` | Sí | `30` | Cambiar a `90` solo con SKU `pro_pass_90d` creado en Play Console. |
| `NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS` | Sí | `30` | Debe coincidir con el server. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` | Sí | falta | |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` | Sí | falta | **Secret.** Incluir saltos `\n` literales. |
| `GOOGLE_PLAY_ACCOUNT_SALT` | Sí | falta | **Secret estable.** No rotar después de launch. |

#### Resend (email)

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `RESEND_API_KEY` | Sí | falta | **Secret.** Hasta que haya dominio verificado, emails salen del sandbox; ver `email-domain.md`. |

#### Security

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `CRON_SECRET` | Sí | falta | **Secret.** ≥64 chars. Generado con `node scripts/generate-secrets.js`. Sin esto los crons devuelven 401. |
| `ADMIN_JWT_SECRET` | Sí | falta | **Secret.** ≥128 chars. |

#### Rate limiting (opcional)

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `UPSTASH_REDIS_REST_URL` | No | recomendado | Sin esto, rate limit usa memoria del lambda (no compartido entre instancias). |
| `UPSTASH_REDIS_REST_TOKEN` | No | recomendado | **Secret.** |

#### Logging (opcional)

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `LOG_LEVEL` | No | `info` | |
| `OBSERVABILITY_WEBHOOK_URL` | No | opcional | Solo si querés SIEM/Datadog además de Sentry. |
| `WEBHOOK_EVENT_RETENTION_DAYS` | No | `30` | Retención de `payment_webhook_events`. |

#### Login security (opcional)

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `LOGIN_LOCKOUT_RESET_HOURS` | No | `24` | |
| `LOGIN_LOCKOUT_RETENTION_DAYS` | No | `90` | Usado por `security-maintenance` cron. |

#### Admin hardening

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `ADMIN_MFA_TOTP_SECRET` | Condicional | recomendado | Base32. Vacío deshabilita MFA. Recomendado tenerlo seteado antes de exponer el admin. |
| `ADMIN_PASSWORD_MAX_AGE_DAYS` | No | `90` | `0` desactiva expiración. |

#### Sentry

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sí | ✅ | |
| `SENTRY_ORG` | Sí | ✅ | Usado por el plugin en build. |
| `SENTRY_PROJECT` | Sí | ✅ | Idem. |
| `SENTRY_AUTH_TOKEN` | Sí | ✅ | **Secret.** Rotado post-exposure. |

#### Manual bank transfer

| Var | Requerida | Producción | Notas |
|-----|-----------|------------|-------|
| `BANK_TRANSFER_INSTRUCTIONS_JSON` | Sí | falta | **Crítico.** Si no se setea como JSON array de `BankAccount` no vacío, `/pago-manual` devuelve 503 al usuario. Sin esta var no hay flujo de cobro manual. |

### 1.3 Migrations y datos

- [ ] Migrations 001–046 (y la migración fechada `20241228_add_debt_tags.sql`)
      están aplicadas en producción. Desde mayo 2026, **las migrations se
      aplican automáticamente a producción** vía GitHub Actions cuando algo
      mergea a `main` bajo `supabase/migrations/`. Ver
      `docs/operational/migration-deployment.md` para el workflow, secrets
      requeridos, y runbook de fallas.

- [ ] Verificación rápida del estado actual:

      ```sql
      select version from supabase_migrations.schema_migrations
      order by version desc
      limit 5;
      ```

      El top debe ser `046_payments_receipt_url` (o más reciente si se
      agregaron migrations posteriores).

- [ ] Datos mínimos seedeados. Para crear el primer admin user, usar el script
      `scripts/seed-admin.js` apuntado a la URL de producción. Ese script crea
      la fila en `auth.users` y la entry en `admin_users`; correr una sola vez.

- [ ] **Backup pre-launch obligatorio.** Antes de tocar producción para el
      launch, correr `npm run backup:prod` manualmente y verificar el JSON
      `{"status":"success"}` final. Procedimiento completo en
      `backup-runbook.md` §4.

### 1.4 Cron jobs y schedules

Los 4 crons activos están declarados en `vercel.json`. Tabla de referencia
(detalle, troubleshooting y duración esperada en `cron-schedules.md`):

| Path | UTC | GT | Propósito | Última corrida verificada |
|------|-----|----|-----------|---------------------------|
| `/api/cron/security-maintenance` | `0 6 * * *` | 00:00 | Limpia lockouts, rota secretos internos, purga sesiones inválidas. | TODO: verify post-launch |
| `/api/cron/payment-reminders` | `0 12 * * *` | 06:00 | Emails de recordatorio (Resend). | TODO: verify post-launch |
| `/api/cron/lifecycle` | `30 12 * * *` | 06:30 | Touchpoints de lifecycle (TRIAL→FREE, expiración PRO). | TODO: verify post-launch |
| `/api/cron/process-deletions` | `0 13 * * *` | 07:00 | Procesa account deletions tras 7-day grace. | TODO: verify post-launch |

- [ ] Las 4 entradas existen en `vercel.json` y el cron schedule está activo
      en Vercel Dashboard → Project → Cron Jobs.
- [ ] `CRON_SECRET` está seteado en producción (sin él los crons reciben pero
      devuelven 401).
- [ ] Tras 24h post-launch, verificar en Vercel → Functions logs que cada cron
      corrió con HTTP 200 y dentro del timeout.

### 1.5 Observabilidad

- [ ] Sentry conectado y eventos llegando. Verificación: dispara un error
      sintético desde el endpoint de prueba interno y ver el issue en el
      dashboard de Sentry en <5 min.
- [ ] Las 4 reglas de alerta del proyecto Sentry están **Active** y limitadas
      a `production`:
  - P1 billing (`event.transaction:/api/billing/*`, `event.count >= 5 / 5 min`).
  - P1 fatal (`level:fatal`, `event.count >= 1 / 1 min`).
  - P2 nuevos digest (`is:new`, daily 08:00 GT).
  - Release error-rate ≥2x post-deploy (ventana 30 min).
  - Detalle de cada regla en `src/lib/observability/sentry-alerts.md`.
- [ ] Email del founder configurado como destinatario en las 4 reglas.
- [ ] Si se configura `SLACK_WEBHOOK_URL`, canal `#alerts-prod` añadido a P1 y
      release.
- [ ] `OBSERVABILITY_WEBHOOK_URL` opcional configurado si se quiere enviar
      warn/error a un SIEM/Datadog además de Sentry.
- [ ] Health endpoint `/api/healthz` responde 200 a `curl` desde fuera de
      Vercel.
- [ ] Readiness endpoint `/api/readiness` responde 200.
- [ ] Logger redact paths cubren PII financiera. Ya implementado en
      `src/lib/logger.ts`; sólo confirmar que no se introdujeron campos nuevos
      sin sanitización.

### 1.6 Legal y compliance GT

- [ ] Disclaimer financiero visible en los surfaces críticos: dashboard Plan,
      pantalla Forecast, footers de los emails de recordatorio.
- [ ] Política de privacidad publicada en `/privacy` (ruta `src/app/privacy`).
- [ ] Términos publicados en `/terms` (ruta `src/app/terms`).
- [ ] Política FEL documentada y leída por el founder (`fel-emission-policy.md`).
      Mientras no haya certificador integrado, las primeras facturas se
      emiten **manualmente** desde la Agencia Virtual SAT o el portal del
      certificador.
- [ ] Self-service de eliminación de cuenta funcional. Flujo:
      `/settings/delete-account` crea fila en `account_deletion_requests`
      con `scheduled_for = now() + 7 days`; el cron `process-deletions` la
      procesa.
- [ ] Export CSV de datos crudos disponible para usuarios FREE desde
      configuración (derecho al portabilidad).

### 1.7 Smoke tests por surface

Mini-checklist manual a correr en producción justo antes del launch. Anotar
cualquier desviación; cero rojos antes de publicar el primer enlace.

#### Landing pública (`/`)

- [ ] H1 visible above-the-fold.
- [ ] FAQ accordion abre y cierra.
- [ ] Hero CTAs llevan a `/signup`.
- [ ] Footer links (privacidad, términos) funcionan.
- [ ] Sticky mobile nav aparece en viewport `<768px`.

#### Auth flow

- [ ] `/signup` acepta email/password con validación mínima de 8 chars +
      score zxcvbn aceptable.
- [ ] `/login` aplica rate limit y dispara progressive lockout tras N
      intentos fallidos.
- [ ] `/onboarding` corre los 5 pasos: currency → frequency → goal →
      motivation (opcional) → complete.
- [ ] `/forgot-password` envía email (verificar que llega aunque sea del
      sandbox).
- [ ] Tras onboarding con `deudas = 0`, el dashboard renderiza
      `FirstRunWelcome`.

#### Dashboard

- [ ] Subtítulo del header personalizado con el nombre del usuario.
- [ ] Sin "ghost pills": pills de plan / alertas sólo se renderizan si hay
      datos reales que mostrar.
- [ ] `FirstRunWelcome` → CTA "Agrega tu primera deuda" funciona.
- [ ] Tras crear la primera deuda, el grid de 8 cards reemplaza a
      `FirstRunWelcome` en el siguiente render.

#### Pago manual (`/pago-manual`)

- [ ] El endpoint **no** devuelve 503 (es decir, `BANK_TRANSFER_INSTRUCTIONS_JSON`
      está configurado con al menos una cuenta válida).
- [ ] El `ref_code` generado se persiste y se muestra al usuario.
- [ ] El email de instrucciones llega al inbox del usuario.

#### Comprobantes de pago

- [ ] `/payments` muestra la columna "Comprobante" con CTA "Subir comprobante"
      o thumbnail (según haya recibo previo).
- [ ] `/payments/[id]/upload-receipt` acepta JPG / PNG / HEIC / HEIF / PDF
      hasta 5 MB.
- [ ] Tras upload, el link "Ver" abre un signed URL en una pestaña nueva.
- [ ] **Bloqueado**: native camera path (`Camera.getPhoto`). Necesita
      `npx cap sync android` y verificación en device físico. Ver
      `storage-buckets.md` sección "Android: `@capacitor/camera` install
      follow-up".

#### Account deletion

- [ ] `/settings/delete-account` crea el request con `scheduled_for` a 7 días.
- [ ] Email de confirmación llega al usuario con el plazo y opción de cancelar.
- [ ] Cancelar dentro de 7 días lo cancela y limpia la fila.
- [ ] Pasado el plazo, el cron `process-deletions` borra los datos (verificar
      manualmente la primera vez que ocurra).

#### Admin

- [ ] Login de admin requiere TOTP si `ADMIN_MFA_TOTP_SECRET` está set.
- [ ] Dashboard de funnel renderiza con datos reales.
- [ ] Grant manual de subscription PRO desde el panel admin actualiza la fila
      en `subscriptions` y refleja el cambio en el dashboard del usuario.

## 2. Launch day (orden de operaciones)

Ejecutar idealmente con 30 min de margen antes del primer anuncio público.

1. **Backup pre-launch.** Correr `npm run backup:prod` manualmente y confirmar
   `{"status":"success"}`. Si falla, abortar el launch y resolver primero.
2. **Confirmar `vercel.json`.** Sin cambios sin commitear; los 4 crons
   declarados; el último deploy a `main` es el target de producción.
3. **Smoke test final en producción.** Correr §1.7 entero o, al menos, los
   bloques de landing, auth, dashboard, pago manual y comprobantes.
4. **Anunciar maintenance window** sólo si vas a rotar un secret en caliente.
   En el flujo normal de launch, **no debería ser necesario**.
5. **Configurar el monitor de Sentry en tiempo real.** Abrir el dashboard del
   proyecto en una pestaña y dejarlo visible durante las primeras horas para
   ver eventos según lleguen.
6. **(Cuando tengas dominio)** Apuntar DNS al alias `rutacero.vercel.app` o
   configurar el dominio custom en Vercel → Project → Domains. SPF/DKIM en
   Resend (`email-domain.md` §2) deben estar verificados antes de cambiar el
   `from` por defecto en `src/lib/resend/client.ts`.
7. **Publicar la landing oficialmente.** Primer enlace público (post en
   redes, mensajes directos, etc.). Anotar timestamp en bitácora para
   correlación con métricas y alertas de Sentry.

## 3. Post-launch (primeras 72h)

Cadencia recomendada: revisión activa cada 2–4 h durante el día, una revisión
ligera antes de dormir, repetir. Pasadas 72 h sin incidentes, bajar a daily
check.

- [ ] **Sentry — issues nuevos.** Revisar la lista de `is:new` cada 2–4 h.
      Triar: ignorar / asignar / convertir a hotfix.
- [ ] **`payment_webhook_events` table.** Revisar que no se acumulen filas
      con `status` distinto de `processed`. Webhooks de Recurrente que fallen
      quedan visibles ahí.
- [ ] **Vercel deployment + function logs.** Buscar 5xx en los endpoints de
      `/api/billing/*`, `/api/payments/*` y `/api/cron/*`.
- [ ] **Resend dashboard.** Revisar bounces / complaints. Un spike de bounces
      en las primeras 24 h suele indicar problema con SPF/DKIM o con la
      reputación del subdominio nuevo.
- [ ] **Crons.** Después de la primera ventana de cada cron (ver §1.4),
      confirmar que corrieron 200 OK y dentro del timeout. Actualizar la
      columna "Última corrida verificada" de §1.4 con la fecha.
- [ ] **Backups.** Confirmar que el cron / GitHub Action de backup ejecutó
      cada noche y subió a B2/R2. Procedimiento de verificación mensual en
      `backup-runbook.md` §6.

Si todo está estable a las 72 h, relajar a daily check y agendar el primer
DR drill mensual.

## 4. Rollback playbook

### Caso: Deploy con bug crítico en `main`

1. Vercel dashboard → **Deployments** → encontrar el último deploy estable
   previo → **Promote to Production**. Rollback instantáneo.
2. **NO** usar `git revert` + push como primer movimiento: es más lento que
   el promote y deja la rama en un estado raro. El promote no cambia la rama;
   sólo apunta el alias de producción al build anterior.
3. Investigar el root cause sin presión de prod.
4. Hotfix con PR siguiendo el flujo normal; mergear cuando esté verde.

### Caso: Vercel webhook no auto-deployó merge a `main`

Hemos visto esto múltiples veces durante el setup de Sentry y comprobantes.
Si pasa de nuevo:

1. Refrescar el token del CLI: `vercel login`.
2. Desde el checkout local del repo, en la rama `main` actualizada:
   `npx vercel deploy --prod --yes`.
3. Alternativa "sucia pero rápida": commit vacío y push para retriggerar el
   webhook:
   ```bash
   git commit --allow-empty -m "chore: retrigger deploy"
   git push origin main
   ```
4. Si el problema persiste tras dos eventos, revisar Vercel → Project →
   Settings → Git → estado de la integración GitHub. Re-conectar si dice
   "Disconnected" o "Last delivery failed".

### Caso: Migration con problema

1. **NUNCA** hacer rollback de migration en producción sin un backup
   verificado de las últimas 24 h.
2. Revisar `backup-runbook.md` sección 7 ("Disaster Recovery playbook") y
   seguirla literal.
3. Si el cambio fue aditivo (column-add, index-create), no rollbackear:
   escribir una migration siguiente que limpie. Las migrations son
   forward-only por convención del repo.
4. Si el cambio destruyó datos, restore desde el último backup
   `{"status":"success"}` previo al incidente. Procedimiento en
   `backup-runbook.md` §7.

### Caso: Supabase project suspendido

Pasó durante este ciclo. Supabase suspende projects del plan free después de
7 días sin actividad de API.

1. Login en <https://supabase.com> → seleccionar el project → **Restore**.
2. Tarda 2–5 min en volver online.
3. Verificar conexión: cualquier query desde la app (login, /finances), o
   `curl` a `/api/healthz`.
4. Si esto se vuelve a repetir, evaluar upgrade al plan Pro. Para producción
   real, el plan free es frágil.

### Caso: Sentry no recibe eventos

Pasó durante el setup por una `tunnelRoute` rota en Turbopack.

1. **Confirmar que `Sentry.init()` se está llamando en cliente.** DevTools →
   Network → filtrar por `ingest.us.sentry.io` o por la ruta `/monitoring`
   (que es el tunnel proxy). Cuando un evento se dispara, ahí debe haber un
   POST.
2. **Verificar las 4 env vars de Sentry en Vercel** (production **y**
   preview). El plugin de build necesita `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`
   y `SENTRY_PROJECT`; el runtime sólo necesita `NEXT_PUBLIC_SENTRY_DSN`.
3. **Test directo a la ingestion API.** Procedimiento detallado en
   `src/lib/observability/sentry-alerts.md` (envío manual de envelope vía
   `curl`). Si ese curl funciona y la app no, el problema es código /
   `tunnelRoute` / CSP, no Sentry.
4. **Revisar CSP en `next.config.ts`.** `connect-src` debe incluir el origen
   del DSN cuando el server-side reporta directo (el navegador pasa por el
   tunnel `/monitoring`, así que no necesita whitelist, pero sí el server).

## 5. Referencias cruzadas

Docs operacionales en el repo. Esta checklist resume; el detalle está allá.

- `docs/operational/backup-runbook.md` — RTO/RPO, ejecución manual del
  backup, verificación mensual, DR playbook.
- `docs/operational/cron-schedules.md` — schedules UTC ↔ GT, cómo añadir un
  cron nuevo, troubleshooting.
- `docs/operational/email-domain.md` — compra de dominio, SPF/DKIM en Resend,
  cambios de código requeridos post-verificación.
- `docs/operational/fel-emission-policy.md` — política de Factura Electrónica
  En Línea, certificador recomendado (INFILE), flujo manual hasta automatizar.
- `docs/operational/migration-deployment.md` — workflow de auto-aplicación de
  migrations en CI, secrets requeridos, runbook de fallas, rollback.
- `docs/operational/storage-buckets.md` — provisión y policies del bucket
  `payment-receipts`, follow-up de `@capacitor/camera` en Android.
- `src/lib/observability/sentry-alerts.md` — reglas P1/P2/release, pasos para
  aplicarlas en el dashboard, notas del SDK pattern actual.
- `docs/superpowers/plans/2026-05-09-pre-launch.md` — plan original de
  pre-launch con T-IDs y entregables por fase.
- `docs/superpowers/plans/2026-05-09-rutacero-monetizacion.md` — plan de
  monetización (Recurrente, Google Play, pago manual, FEL).

## 6. Última revisión

`2026-05-12 — Founder`
