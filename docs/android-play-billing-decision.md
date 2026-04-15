# Decision: cobro Android dentro de Google Play sin recurrencia

Fecha de verificacion: 2026-04-14.

## Resumen ejecutivo

- La ruta actual de Android no cumple con la restriccion de cobrar dentro del ecosistema de Google Play para funcionalidades digitales dentro de la app.
- `Google Pay` no es el mecanismo correcto para desbloquear `RutaCero PRO` dentro de una app distribuida por Google Play.
- La ruta correcta es `Google Play Billing`.
- Recomendacion tecnica: para Android, reemplazar el checkout de `Recurrente` por un producto de `Google Play Billing` sin auto-renovacion. La opcion recomendada para conservar un acceso temporal sin cobro recurrente es un pase `PRO` de 30 dias comprado como producto one-time y reactivado manualmente por el usuario.

## Por que la ruta actual no sirve

Hoy el repo hace esto:

- [`src/app/(app)/checkout/page.tsx`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/src/app/(app)/checkout/page.tsx) llama `/api/recurrente/create-checkout`.
- [`src/app/api/recurrente/create-checkout/route.ts`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/src/app/api/recurrente/create-checkout/route.ts) crea una suscripcion mensual `RutaCero PRO` en `Recurrente`.
- [`src/lib/recurrente/open-checkout.ts`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/src/lib/recurrente/open-checkout.ts) abre ese checkout hospedado en navegador externo cuando la app corre dentro de Capacitor.
- [`src/app/(app)/settings/settings-client.tsx`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/src/app/(app)/settings/settings-client.tsx) asume un flujo de cancelacion de suscripcion via `Recurrente`.

Eso puede funcionar como checkout web o PSP externo, pero no como compra de funcionalidad digital dentro de una app distribuida por Google Play.

## Validacion de politica y producto

Google documenta dos cosas relevantes:

- La politica de pagos de Google Play exige `Google Play Billing` para apps distribuidas por Play que cobren por funcionalidades, contenido digital o software tipo `financial management software`.
- Google Pay es un flujo de checkout donde la app recibe un token de pago y el backend procesa la compra con un PSP. Eso no sustituye a Google Play Billing para digital goods dentro de Play.

Fuentes oficiales consultadas:

- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play billing FAQ / policy help: https://support.google.com/googleplay/android-developer/answer/16070163
- Google Pay API for Android overview: https://developers.google.com/pay/api/android/overview
- Google Play Billing one-time products: https://developer.android.com/google/play/billing/one-time-product-multi-purchase-options-offers

Inferencia aplicada al caso de RutaCero:

- `RutaCero PRO` desbloquea funciones digitales dentro de la app.
- RutaCero entra razonablemente en la categoria de software de gestion financiera.
- Por lo tanto, un checkout externo con `Recurrente` o con `Google Pay` procesado por PSP no es la ruta correcta dentro de la app Android publicada en Google Play.

## Decision tecnica

### Ruta recomendada

Usar `Google Play Billing` para Android y modelar el upgrade de PRO sin auto-renovacion.

Recomendacion concreta:

- Producto Android recomendado: `pro_pass_30d`.
- Tipo recomendado: producto `one-time` con acceso temporal otorgado por backend.
- Comportamiento: el usuario compra 30 dias de PRO dentro de la app; no hay auto-renovacion; cuando expire, el usuario vuelve a comprar manualmente.

Por que esta opcion es la recomendada:

- Respeta la restriccion del board de evitar cobro recurrente.
- Mantiene un modelo parecido al precio y cadencia actuales de `Q49/mes`.
- Se mantiene completamente dentro de Google Play para la compra en Android.

### Lo que no recomiendo

- No usar `Google Pay` como sustituto de `Google Play Billing` para PRO dentro de la app.
- No mantener el checkout de `Recurrente` dentro del flujo Android publicado en Play.
- No seguir abriendo el pago en navegador externo como solucion de cumplimiento para digital goods.

### Fallback si el board quiere menos complejidad

Si el board acepta cambiar el modelo comercial en Android, la opcion mas simple tecnicamente es:

- `pro_lifetime_android` como producto one-time no recurrente.

Ventaja:

- Menor complejidad de expiracion, renovacion manual y restauracion.

Desventaja:

- Cambia el modelo de negocio de acceso temporal a unlock permanente.

## Implicaciones de implementacion

### 1. Billing nativo en Android

Capacitor no resuelve esto por si solo. Hay que integrar `Google Play Billing Library 8` desde el contenedor Android:

- mediante un plugin de Capacitor mantenible, o
- mediante un bridge nativo propio.

Capacidades minimas:

- consultar `ProductDetails`
- lanzar `launchBillingFlow()`
- manejar compras pendientes y exitosas
- `acknowledge` o `consume` segun el tipo de producto
- restaurar estado de compra relevante al reinstalar o cambiar de dispositivo

### 2. Verificacion server-side

No conviene confiar solo en el cliente Android.

Se necesita un endpoint backend para:

- recibir `purchaseToken`, `productId`, `orderId` y usuario autenticado
- verificar la compra con Google Play Developer API
- registrar el grant de acceso
- evitar grants duplicados

### 3. Modelo de datos

La tabla actual de `subscriptions` esta sesgada a recurrencia:

- provider / external_id / renew_at / cancel_at

Referencias:

- [`supabase/migrations/001_initial_schema.sql`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/supabase/migrations/001_initial_schema.sql)
- [`src/types/supabase.ts`](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/src/types/supabase.ts)

Para el pase no recurrente recomiendo agregar una tabla nueva de entitlements, por ejemplo `billing_entitlements`, con:

- `tenant_id`
- `user_id`
- `platform`
- `provider`
- `product_id`
- `purchase_token`
- `order_id`
- `granted_at`
- `expires_at`
- `status`
- `last_verified_at`

La tabla `subscriptions` se puede mantener para web si web sigue usando `Recurrente`.

### 4. UX a reemplazar

Hay que reemplazar el flujo Android que hoy asume suscripcion mensual:

- CTA de pricing / checkout
- copy de `Q49/mes`
- pantalla de settings que hoy habla de cancelacion y renovacion
- recovery y reporting que hoy dependen de webhook/suscripcion de `Recurrente`

### 5. Analytics y soporte

Hay que adaptar eventos y soporte operativo:

- reemplazar `checkout_started` y eventos de suscripcion cuando la compra venga de Play Billing
- distinguir `provider = google_play`
- registrar expiracion manual del pase y nueva compra

## Riesgos y notas de cumplimiento

- Si Android usa Play Billing y web mantiene `Recurrente`, habra dos rutas de monetizacion y dos modelos de entitlement.
- Un pase de 30 dias exige logica clara de expiracion y reactivacion manual.
- Las compras deben confirmarse correctamente para no perder ingresos ni dejar compras sin conceder.
- Si el equipo quiere tiempo limitado pero mas limpio que un pase one-time, Google Play tambien ofrece modelos de suscripcion. No los recomiendo para este requerimiento porque el board pidio evitar suscripciones.

## Siguiente paso de ejecucion

Abrir implementacion para Engineering con este alcance:

1. Integrar Google Play Billing en Android via plugin/bridge nativo.
2. Crear verificacion server-side de compras de Play.
3. Crear entitlements no recurrentes para Android.
4. Reemplazar CTA/checkout Android para que use Play Billing en lugar de `Recurrente`.
5. Ajustar settings, analytics y soporte para el nuevo modelo.

## Decision final

- `Google Pay` no es la respuesta correcta para PRO dentro de la app Android de RutaCero.
- `Google Play Billing` si lo es.
- La recomendacion ejecutable bajo la restriccion de no recurrencia es `Google Play Billing` con un `PRO pass` manual, no auto-renovable, validado server-side.
