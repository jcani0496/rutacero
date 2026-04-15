# Serverless y Google Pay

> Nota 2026-04-14: este documento describe la ruta previa de checkout hospedado con `Recurrente` + `Google Pay`.
> Para compras de funcionalidades digitales dentro de la app Android distribuida por Google Play, esa ruta no sustituye `Google Play Billing`.
> Ver decision vigente en [`docs/android-play-billing-decision.md`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/docs/android-play-billing-decision.md).

RutaCero ya corre sobre Next.js App Router y Supabase, asi que la opcion mas simple de serverless es desplegar el frontend/API de Next.js en Vercel Hobby y mantener Postgres/Auth en Supabase.

## Decision tecnica

- Hosting serverless recomendado: Vercel Hobby para `app.rutacero.com`.
- Base de datos y auth: Supabase administrado.
- Pagos: checkout hospedado por Recurrente.
- Android/Capacitor: abrir checkout en navegador externo nativo para evitar limitaciones de WebView con wallets como Google Pay.

## Secuencia de rollout

1. Cerrar smoke en telefono fisico con `CAPACITOR_SERVER_URL` apuntando al dominio productivo.
2. Crear proyecto Vercel conectado a este repo y cargar variables de entorno.
3. Configurar webhook de Recurrente apuntando a `https://app.rutacero.com/api/webhooks/recurrente`.
4. Habilitar Google Pay en el comercio de Recurrente antes de pruebas finales.
5. Ejecutar smoke de checkout Android real, webhook y retorno a estado `ACTIVE`.

## Credenciales pendientes del board

- `RECURRENTE_PUBLIC_KEY`
- `RECURRENTE_SECRET_KEY`
- `RECURRENTE_WEBHOOK_SECRET`
- acceso al proyecto/dominio de Vercel o confirmacion del dominio final
- confirmacion de que Google Pay esta habilitado en la cuenta merchant de Recurrente

## Cambio aplicado en codigo

- El checkout de Android nativo ya no depende de redireccion dentro del WebView.
- En plataformas Capacitor, el pago se abre en navegador externo para mejorar compatibilidad con Google Pay.
- En web se mantiene la navegacion normal hacia el checkout hospedado.
