# Cron schedules — RutaCero

## 1. Resumen

Vercel ejecuta los crons declarados en `vercel.json` en horario UTC. Guatemala usa
UTC-6 (sin horario de verano), así que la conversión a GT siempre es UTC menos 6
horas. Esta tabla es la fuente de verdad de qué corre, cuándo y para qué.
Cualquier cambio en `vercel.json` debe actualizarse aquí en el mismo commit.

## 2. Crons activos

| Path | UTC | GT (UTC-6) | Propósito | Endpoint |
|------|-----|------------|-----------|----------|
| `/api/cron/security-maintenance` | `0 6 * * *` | 00:00 GT | Limpieza de tokens expirados, rotación de secrets internos, purga de sesiones inválidas. Diseñado para correr en horario de bajo tráfico (medianoche GT). | `src/app/api/cron/security-maintenance/route.ts` |
| `/api/cron/payment-reminders` | `0 12 * * *` | 06:00 GT | Envía recordatorios por email a usuarios con suscripciones próximas a vencer o con cobros fallidos. 06:00 GT garantiza que el correo llegue antes de la jornada laboral. | `src/app/api/cron/payment-reminders/route.ts` |
| `/api/cron/lifecycle` | `30 12 * * *` | 06:30 GT | Transiciones automáticas de ciclo de vida: paso de TRIAL a FREE, expiración de PRO, marcas de inactividad. Corre 30 min después de los recordatorios para que el estado del usuario ya refleje su última oportunidad de pagar. | `src/app/api/cron/lifecycle/route.ts` |
| `/api/cron/process-deletions` | `0 13 * * *` | 07:00 GT | Procesa la cola de eliminaciones de cuenta solicitadas por el usuario (GDPR / derecho al olvido). Corre después de lifecycle para no eliminar cuentas justo cuando recién cambiaron de estado. | `src/app/api/cron/process-deletions/route.ts` |

### Duración esperada por cron

Estimaciones para volumen actual (<1k usuarios). Re-evaluar cuando el volumen
crezca un orden de magnitud.

- `security-maintenance`: < 30 s.
- `payment-reminders`: < 60 s, dominado por latencia de Resend.
- `lifecycle`: < 30 s.
- `process-deletions`: < 30 s en operación normal; puede crecer si se acumulan
  solicitudes pendientes.

Vercel impone un timeout de 60 s en funciones serverless del plan Hobby y 300 s
en Pro. Si un cron supera esos límites, hay que dividir el trabajo en lotes o
mover la lógica a una worker queue.

## 3. Crons futuros

Endpoints planificados que aún no existen y, por lo tanto, no están en
`vercel.json`. Añadir a la tabla de arriba en el momento de habilitarlos.

- **`/api/cron/whatsapp-reminders`** (Phase F) — recordatorios por WhatsApp para
  usuarios que opten por ese canal. Probable ventana: 06:15 GT (`15 12 * * *`),
  intercalado con email para no saturar.
- **`/api/cron/backup-verification`** (T35) — verificación diaria de la
  restauración del último backup de Supabase. Probable ventana: 04:00 GT
  (`0 10 * * *`), antes del primer cron operativo del día.

## 4. Cómo añadir un nuevo cron

1. **Crear el endpoint** bajo `src/app/api/cron/<nombre>/route.ts`. Que exporte
   `GET` (Vercel invoca crons como GET) o `POST` según convención del proyecto.
2. **Validar `CRON_SECRET`** al inicio del handler. Vercel envía el header
   `Authorization: Bearer $CRON_SECRET`; rechazar con 401 si no coincide. Reutilizar
   el helper que ya usan los crons existentes para consistencia.
3. **Añadir la entrada a `vercel.json`** en el array `crons`, con `path` y
   `schedule` (cron expression UTC). Mantener orden cronológico ascendente para
   facilitar lectura.
4. **Documentar aquí** en la tabla de "Crons activos": path, UTC, GT, propósito,
   endpoint y duración estimada.

## 5. Operación y troubleshooting

- **Logs:** Vercel Dashboard → Project → Functions → seleccionar el cron por path.
  Cada invocación queda con timestamp UTC.
- **Re-ejecución manual:** llamar al endpoint con `curl` y header
  `Authorization: Bearer $CRON_SECRET` desde una shell autorizada. Útil para
  validar fixes sin esperar a la siguiente ventana.
- **Monitoreo de fallas:** los errores de los crons quedan en Sentry bajo el
  filtro `event.transaction:/api/cron/*`. La regla P2 de errores nuevos los
  captura por defecto.

## 6. Última revisión

`2026-05-10 — Founder`
