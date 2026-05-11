# Runbook — Reglas de alertas Sentry para RutaCero

## 1. Propósito

Este documento define las reglas de alertas que deben existir en el proyecto Sentry
de RutaCero. La intención es detectar de forma temprana fallas que afectan ingresos
(billing), regresiones graves introducidas por un release, y errores nuevos que
podrían convertirse en incidentes si pasan desapercibidos. La creación efectiva de
las reglas se hace a mano en el dashboard de Sentry (no se versiona en código);
este runbook es la fuente de verdad de **qué** debe estar configurado.

## 2. Reglas P1 — acción inmediata

P1 = paginar al founder en cuanto dispare. Las dos reglas siguientes son las únicas
que se permiten escalar a este nivel; cualquier otra debe entrar como P2 para no
diluir la señal.

### 2.1 Errores en endpoints de billing

- **Condición:** `event.count >= 5` en una ventana de `5 min`.
- **Filtro:** `event.transaction` matches `/api/billing/*`.
- **Por qué P1:** una falla sostenida en billing impide cobrar (Recurrente,
  webhook callbacks, generación de plan PRO). Cada minuto sin cobrar es ingreso
  perdido y, peor, deja al usuario en un estado inconsistente (pagó y no recibió
  PRO, o recibió PRO sin pagar).
- **Acción esperada:** revisar logs del endpoint, verificar estado del webhook de
  Recurrente y de la base de datos. Si el incidente dura >15 min, congelar nuevas
  suscripciones desde el panel admin.

### 2.2 Cualquier evento con `level:fatal`

- **Condición:** `event.count >= 1` en `1 min`.
- **Filtro:** `level:fatal`.
- **Por qué P1:** los eventos fatales se reservan para crashes que tumban la app
  en cliente o procesos del servidor que mueren. Uno solo basta para investigar.
- **Acción esperada:** abrir el evento, revisar el stack trace y release asociado;
  si coincide con un deploy reciente, evaluar rollback.

## 3. Reglas P2 — acción en 24 h

P2 = email digest, no paginación. Se revisan al inicio de cada jornada.

### 3.1 Errores nuevos sin agrupación previa

- **Condición:** issue marcado como `is:new` por Sentry (primera vez que aparece la
  fingerprint).
- **Frecuencia:** **daily digest** a las 08:00 GT.
- **Por qué P2:** un error nuevo no es necesariamente urgente, pero acumular
  errores nuevos sin triaje degrada la calidad del producto. El digest diario
  obliga a hacer el barrido de la lista al menos una vez por día.
- **Acción esperada:** triar cada nuevo issue: ignorar / asignar / convertir a
  ticket.

## 4. Regla de release — comparación de error rate

Cada deploy debe compararse contra la línea base previa para detectar regresiones.

- **Condición:** error rate del release nuevo `>= 2x` el error rate del release
  anterior, medido en una ventana de `30 min` post-deploy.
- **Filtro:** `release:<nuevo-release>` vs. línea base `release:<release-anterior>`.
- **Frecuencia:** evaluación una sola vez, automática, 30 min después del deploy.
- **Acción esperada:** si dispara, abrir la lista de errores nuevos del release y
  decidir entre hotfix o rollback (Vercel → Deployments → Promote previous).

## 5. Canales de notificación

- **Email del founder:** siempre activo, en todas las reglas (P1 y P2).
- **Slack:** opcional. Cuando se configure el webhook (variable de entorno
  `SLACK_WEBHOOK_URL`, todavía no creada), añadir el canal `#alerts-prod` a las
  reglas P1 y a la regla de release. Las P2 quedan solo en email.
- **SMS / PagerDuty:** fuera de alcance hasta que exista un equipo de guardia.

## 6. Cómo aplicar las reglas en el dashboard

Pasos para crear cada regla. Repetir el flujo por cada una de las definidas arriba.

1. Entrar a `https://sentry.io` con la cuenta del founder.
2. Seleccionar el proyecto `rutacero` (o el slug equivalente del proyecto).
3. Navegar a **Settings → Alerts → Create Alert Rule**.
4. Elegir el tipo de alerta:
   - **Issue Alert** para las reglas 2.2, 3.1 y 4.
   - **Metric Alert** para la regla 2.1 (cuenta de eventos por transacción).
5. Configurar las condiciones y filtros tal como aparecen arriba (copiar el
   texto de `Condición` y `Filtro` literalmente).
6. En **Actions**, añadir el email del founder. Si el webhook de Slack ya existe,
   añadirlo también para reglas P1 y release.
7. En **Environment**, seleccionar `production`. No activar reglas en `preview`
   ni en `development` para evitar ruido.
8. Guardar y verificar que la regla aparece en estado **Active** en la lista.

## 7. Verificación

Lista de checks manuales que el founder debe poder marcar tras configurar todo.
Repetir esta verificación al menos una vez al mes y después de cualquier cambio
en las reglas.

- [ ] Regla 2.1 (billing >5 errores en 5 min) existe y está **Active**.
- [ ] Regla 2.2 (`level:fatal`) existe y está **Active**.
- [ ] Regla 3.1 (errores nuevos, daily digest 08:00 GT) existe y está **Active**.
- [ ] Regla 4 (release error-rate 2x) existe y está **Active**.
- [ ] Email del founder aparece como destinatario en las cuatro reglas.
- [ ] Si `SLACK_WEBHOOK_URL` está configurado: canal Slack añadido a P1 y
      release.
- [ ] Las cuatro reglas están limitadas al environment `production`.
- [ ] Test de humo: lanzar un error sintético desde `/api/dev/throw` (o equivalente)
      y confirmar que el email llega en menos de 5 min.

## 8. Notas de SDK

- A partir de la migración al patrón actual de `@sentry/nextjs`, la inicialización
  vive en `instrumentation-client.ts` (browser), `instrumentation.ts` (registra
  los configs runtime), `sentry.server.config.ts` (Node) y `sentry.edge.config.ts`
  (edge). El helper anterior `src/lib/observability/sentry-init.ts` fue eliminado.
- El tráfico del navegador hacia Sentry pasa por `tunnelRoute: "/monitoring"`
  para esquivar ad-blockers; no es necesario whitelistear el dominio de Sentry
  en el navegador, pero el server-side sí sigue saliendo directo a `sentry.io`
  (por eso conservamos la entrada en `connect-src` del CSP cuando hay DSN).
- La inicialización está condicionada a `NEXT_PUBLIC_SENTRY_DSN`. Sin DSN no se
  envía nada (modo dev local). Las reglas de este runbook aplican únicamente
  cuando el DSN está configurado en el entorno `production`.

## 9. Última revisión

`2026-05-10 — Founder`
