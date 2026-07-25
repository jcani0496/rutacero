# Cron schedules — RutaCero

## 1. Resumen

Tras la migración a Railway, los crons ya **no** viven en `vercel.json`.
GitHub Actions (`.github/workflows/crons.yml`) invoca los endpoints HTTP de la
app desplegada en Railway con `Authorization: Bearer $CRON_SECRET`.

Guatemala usa UTC-6 (sin horario de verano), así que la conversión a GT siempre
es UTC menos 6 horas. Esta tabla es la fuente de verdad de qué corre, cuándo y
para qué. Cualquier cambio en `crons.yml` debe actualizarse aquí en el mismo
commit.

## 2. Crons activos

| Path | UTC | GT (UTC-6) | Propósito | Endpoint |
|------|-----|------------|-----------|----------|
| `/api/cron/security-maintenance` | `0 6 * * *` | 00:00 GT | Limpieza de tokens expirados, rotación de secrets internos, purga de sesiones inválidas. Diseñado para correr en horario de bajo tráfico (medianoche GT). | `src/app/api/cron/security-maintenance/route.ts` |
| `/api/cron/payment-reminders` | `0 12 * * *` | 06:00 GT | Envía recordatorios por email a usuarios con suscripciones próximas a vencer o con cobros fallidos. 06:00 GT garantiza que el correo llegue antes de la jornada laboral. | `src/app/api/cron/payment-reminders/route.ts` |
| `/api/cron/lifecycle` | `30 12 * * *` | 06:30 GT | Transiciones automáticas de ciclo de vida: paso de TRIAL a FREE, expiración de PRO, marcas de inactividad. Corre 30 min después de los recordatorios. | `src/app/api/cron/lifecycle/route.ts` |
| `/api/cron/process-deletions` | `0 13 * * *` | 07:00 GT | Procesa la cola de eliminaciones de cuenta solicitadas por el usuario (GDPR / derecho al olvido). | `src/app/api/cron/process-deletions/route.ts` |

### Duración esperada por cron

Estimaciones para volumen actual (<1k usuarios). Re-evaluar cuando el volumen
crezca un orden de magnitud.

- `security-maintenance`: < 30 s.
- `payment-reminders`: < 60 s, dominado por latencia de Resend.
- `lifecycle`: < 30 s.
- `process-deletions`: < 30 s en operación normal; puede crecer si se acumulan
  solicitudes pendientes.

Railway no impone el timeout de 60 s de Vercel Hobby; aun así, si un cron
supera ~2–3 min hay que dividir el trabajo en lotes o mover la lógica a una
worker queue.

## 3. Crons futuros

Endpoints planificados que aún no existen. Añadir a la tabla de arriba y a
`crons.yml` en el momento de habilitarlos.

- **`/api/cron/whatsapp-reminders`** (Phase F) — recordatorios por WhatsApp.
  Probable ventana: 06:15 GT (`15 12 * * *`).
- **`/api/cron/backup-verification`** (T35) — verificación diaria de la
  restauración del último backup de Postgres. Probable ventana: 04:00 GT
  (`0 10 * * *`).

## 4. Cómo añadir un nuevo cron

1. **Crear el endpoint** bajo `src/app/api/cron/<nombre>/route.ts`. Exportar
   `GET` y/o `POST` según convención del proyecto.
2. **Validar `CRON_SECRET`** al inicio del handler
   (`Authorization: Bearer $CRON_SECRET`); rechazar con 401 si no coincide.
3. **Añadir el schedule** en `.github/workflows/crons.yml` y mapear el endpoint
   en el job.
4. **Documentar aquí** en la tabla de "Crons activos".

Secrets de repo requeridos: `CRON_SECRET`, `CRON_APP_URL`
(p. ej. `https://web-production-b36897.up.railway.app`).

## 5. Operación y troubleshooting

- **Logs:** GitHub Actions → workflow `Crons` → run; más logs de app en Railway
  Dashboard → service `web` → Deployments / Logs.
- **Re-ejecución manual:** `workflow_dispatch` en Actions, o `curl` con
  `Authorization: Bearer $CRON_SECRET`.
- **Monitoreo de fallas:** Sentry bajo `event.transaction:/api/cron/*`.

## 6. Última revisión

`2026-07-25 — Railway / GitHub Actions cutover`
