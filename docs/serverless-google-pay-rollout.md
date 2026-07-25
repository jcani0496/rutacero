# Serverless y Google Pay

> Nota 2026-04-14: este documento describe la ruta previa de checkout hospedado con `Recurrente` + `Google Pay`.
> Para compras de funcionalidades digitales dentro de la app Android distribuida por Google Play, esa ruta no sustituye `Google Play Billing`.
> Ver decision vigente en [`docs/android-play-billing-decision.md`](android-play-billing-decision.md).
>
> Nota 2026-07-25: el hosting activo es **Railway** (no Vercel). Auth/data/storage
> son better-auth + Railway Postgres + Railway Buckets.

RutaCero corre sobre Next.js App Router desplegado en Railway.

## Decision tecnica

- Hosting: Railway (`web` service); URL actual
  `https://web-production-b36897.up.railway.app` hasta dominio custom.
- Base de datos y auth: Railway Postgres + better-auth.
- Storage: Railway Buckets (`payment-receipts`).
- Pagos web: checkout hospedado por Recurrente.
- Android/Capacitor: abrir checkout en navegador externo nativo para evitar
  limitaciones de WebView con wallets como Google Pay.

## Secuencia de rollout

1. Cerrar smoke en telefono fisico con `CAPACITOR_SERVER_URL` apuntando al
   dominio productivo Railway (o `npm run android:build:prod`).
2. Confirmar variables de entorno en Railway (ver `.env.example`).
3. Configurar webhook de Recurrente apuntando a
   `https://<dominio-prod>/api/webhooks/recurrente`.
4. Habilitar Google Pay en el comercio de Recurrente antes de pruebas finales.
5. Ejecutar smoke de checkout Android real, webhook y retorno a estado `ACTIVE`.

## Credenciales pendientes del board

- `RECURRENTE_PUBLIC_KEY`
- `RECURRENTE_SECRET_KEY`
- `RECURRENTE_WEBHOOK_SECRET`
- confirmacion del dominio final (DNS → Railway)
- confirmacion de que Google Pay esta habilitado en la cuenta merchant de Recurrente
