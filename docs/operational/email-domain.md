# Verificación de dominio de email (Resend) — RutaCero

## 1. Estado actual

A la fecha de este documento, **RutaCero no tiene dominio propio comprado**.
Los emails transaccionales salen desde el sandbox de Resend
(`onboarding@resend.dev`), lo que es aceptable para staging y para los primeros
usuarios beta, pero no para producción: los proveedores de correo (Gmail,
Outlook) tratan ese remitente como genérico, lo cual aumenta la probabilidad de
caer en spam y reduce la confianza percibida del usuario.

Compra del dominio y verificación SPF/DKIM son **bloqueante para el primer cobro
live**. Candidato actual: `rutacero.app` (validar disponibilidad antes de
comprar; alternativas: `rutacero.gt`, `rutacero.com`).

## 2. Pasos cuando se tenga dominio

> TODO: replace `{DOMAIN}` con el dominio efectivamente comprado.

1. **Comprar el dominio** en un registrador (Namecheap, Cloudflare Registrar,
   Porkbun). Cloudflare Registrar es la opción recomendada por costo at-cost y
   por dejar el DNS en Cloudflare desde el inicio.
2. **Apuntar el DNS a Cloudflare** (si no se compró ahí). Esto da un panel
   unificado para los registros TXT/MX que Resend pedirá.
3. **En Resend dashboard**: ir a **Domains → Add Domain** e ingresar `{DOMAIN}`.
4. **Copiar los registros DNS** que Resend muestra. Típicamente son tres:
   - Un **TXT SPF** en el apex (`v=spf1 include:amazonses.com ~all` o
     equivalente).
   - Un **TXT DKIM** con un selector específico de Resend
     (`resend._domainkey.{DOMAIN}`).
   - Un **MX o TXT Return-Path** para bounces (`bounces.{DOMAIN}` o similar
     según lo que Resend instruya en ese momento).
5. **Añadir esos registros en el DNS** del registrador / Cloudflare. Cuidado de
   no duplicar SPF: si ya existe un TXT SPF (por ejemplo de Google Workspace),
   hay que **fusionar** los `include:` en un solo registro, no crear dos.
6. **Esperar propagación.** Suele ser 5–30 min, en el peor caso 24 h. Verificar
   con `dig TXT {DOMAIN}` y `dig TXT resend._domainkey.{DOMAIN}` antes de pulsar
   "Verify" para evitar fallos cosméticos.
7. **En Resend**: pulsar **Verify**. Los tres indicadores deben quedar en verde.
   Si alguno falla, revisar el registro correspondiente y reintentar; no
   continuar al siguiente paso hasta que los tres estén verificados.

## 3. Cambios de código requeridos

Una vez verificado el dominio:

- **`src/lib/resend/client.ts`** — cambiar el remitente por defecto. Hoy:
  `'RutaCero <notificaciones@rutacero.com>'` (línea ~37). Reemplazar por
  `'RutaCero <notificaciones@{DOMAIN}>'`. Este archivo es el único punto que
  define el `from` por defecto; el resto del código pasa por `sendEmail` y
  hereda este valor (verificado con grep `from:` sobre `src/lib/resend/` y
  `src/lib/email/`).
- **Variable de entorno `RESEND_FROM_EMAIL`** (recomendado): refactorizar
  `client.ts` para leer el remitente desde env, con fallback al literal anterior.
  Esto evita re-deploys cuando se cambie de subdominio (p. ej. de
  `notificaciones@` a `noreply@`) y simplifica usar diferentes remitentes en
  preview vs. production.
- **Templates de email** en `src/lib/emails/*` — revisar que ningún template
  tenga el dominio antiguo hardcodeado en el cuerpo (links, footers, dirección
  de respuesta).

## 4. Verificación post-cambio

1. **Email de prueba:** enviar uno al inbox personal del founder desde el panel
   admin (o disparar el flujo de transferencia bancaria en `/pago-manual`, que
   usa `sendEmail`).
2. **Confirmar el remitente:** el email debe llegar como
   `notificaciones@{DOMAIN}`, **no** como `onboarding@resend.dev`. Si llega del
   sandbox, el código no tomó el cambio o la variable de entorno no está
   inyectada en el deploy.
3. **Verificar SPF/DKIM en Gmail:**
   - Abrir el email en Gmail.
   - Menú de tres puntos → **Show original** (Mostrar original).
   - Confirmar `SPF: PASS` y `DKIM: PASS` en la cabecera.
   - Confirmar que el campo `Mailed-by` muestra `{DOMAIN}` y no
     `amazonses.com` o similar.
4. **Test de spam:** enviar un email a una cuenta limpia (Gmail recién creada
   o un servicio como mail-tester.com). Score esperado >= 9/10. Si baja de eso,
   revisar DMARC (no obligatorio pero recomendado añadir un TXT DMARC en
   modo `p=none` para empezar a recolectar reportes).

## 5. Última revisión

`2026-05-10 — Founder`
