# RutaCero (Debt Control)

Aplicación web para planificación de deudas, forecasting, multi-tenant por workspace y panel administrativo.

## Stack
- Next.js 16 (App Router)
- TypeScript
- Supabase local (Auth + Postgres + Storage opcional)
- Vitest + Testing Library
- ESLint

## Requisitos
- Node.js 20+
- npm 10+
- Docker Desktop
- Supabase CLI (`supabase --version`)

## Configuración local
1. Instala dependencias:
```bash
npm ci
```
2. Crea variables locales:
```bash
cp .env.example .env.local
```
Si solo necesitas smoke local de billing/reporting sin credenciales reales de Recurrente, deja esto en `.env.local`:
```bash
RECURRENTE_MOCK_MODE=true
RECURRENTE_WEBHOOK_SECRET=whsec_local_rutacero_1234567890abcdef
```
En modo mock no hacen falta `RECURRENTE_PUBLIC_KEY`/`RECURRENTE_API_KEY` ni `RECURRENTE_SECRET_KEY`; el checkout redirige localmente al success URL para validar el flujo.
3. Inicia Supabase local (usa Docker Desktop, no `docker-compose.yml`):
```bash
supabase start
```
4. Aplica migraciones locales:
```bash
npm run db:push:local
```
5. Valida preflight de smoke local para billing/reporting:
```bash
npm run verify:smoke:local
```
6. (Opcional) crea admin local:
```bash
npm run seed:admin
```
Credenciales seeded por defecto:
- `admin@rutacero.gt`
- `Admin123!`

## Ejecutar
```bash
npm run dev
```

App:
- [http://localhost:3000](http://localhost:3000)

Supabase local:
- API: [http://127.0.0.1:54321](http://127.0.0.1:54321)
- Studio: [http://127.0.0.1:54323](http://127.0.0.1:54323)

## Android nativo
La app Android usa Capacitor como contenedor nativo. Por defecto el APK carga los assets empaquetados para evitar pantallas negras en dispositivos fisicos cuando no hay un servidor web alcanzable.

APK debug empaquetado:

```bash
npm run android:build:debug
```

APK debug:
- `android/app/build/outputs/apk/debug/app-debug.apk`

Para correr la app en un emulador Android local con la instancia web de desarrollo:

```bash
npm run dev
npm run android:start:emulator
npm run android:run:emulator
```

Ese flujo:
- usa `LOCAL_SERVER_URL` si esta definida; si no, intenta detectar la instancia activa de `next dev` del workspace empezando por `http://127.0.0.1:3000`
- deriva `CAPACITOR_SERVER_URL` con el mismo puerto, usando `http://10.0.2.2:<puerto>` cuando el servidor local corre en `localhost`
- instala `app-debug` en el emulador Android conectado
- abre `com.rutacero.app/.MainActivity`

`npm run android:sync` ahora sanea `android/app/src/main/assets/capacitor.config.json` despues del sync para evitar que un build para dispositivo fisico herede por accidente una URL vieja del emulador (`10.0.2.2`/`localhost`) y termine en pantalla negra. Si no defines `CAPACITOR_SERVER_URL`, el APK vuelve a los assets empaquetados.

`npm run android:start:emulator` deja el emulador en primer plano usando un renderer seguro para Apple Silicon. Ejecuta `npm run android:run:emulator` desde una segunda terminal cuando el AVD ya este abierto.

Si quieres abrir solo el emulador sin instalar la app:

```bash
npm run android:start:emulator
```

En macOS Apple Silicon, ese launcher usa por defecto `-gpu swiftshader_indirect` y `-feature -Vulkan` para evitar pantallas negras o glitches del renderer `gfxstream`/MoltenVK. Esto sigue la recomendacion de Android Emulator para problemas graficos en hardware rendering sobre Apple Silicon.

Overrides utiles:

```bash
ANDROID_EMULATOR_AVD=Pixel_9_Pro_XL npm run android:start:emulator
ANDROID_EMULATOR_GPU_MODE=auto ANDROID_EMULATOR_DISABLE_VULKAN=0 npm run android:start:emulator
ANDROID_EMULATOR_EXTRA_ARGS="-wipe-data" npm run android:start:emulator
```

Si abriste el AVD manualmente desde Android Studio y la ventana sale negra aunque `adb`/`logcat` muestran que Android sigue vivo, cambia el renderer a software o reinicialo por CLI con:

```bash
~/Library/Android/sdk/emulator/emulator -avd Pixel_9_Pro_XL -gpu swiftshader_indirect -feature -Vulkan
```

Si solo necesitas construir el APK para emulador sin instalarlo:

```bash
npm run android:build:emulator
```

Para apuntar el contenedor nativo a otra instancia web, define `CAPACITOR_SERVER_URL` de forma explicita. En emulador Android manual, usa el servidor local de la maquina host:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npm run android:build:debug
```

Para forzar un puerto concreto en `android:run:emulator`, puedes mantener ambos valores alineados:

```bash
LOCAL_SERVER_URL=http://127.0.0.1:3200 CAPACITOR_SERVER_URL=http://10.0.2.2:3200 npm run android:run:emulator
```

Para un dispositivo fisico en la misma red, usa la IP LAN de la maquina:

```bash
CAPACITOR_SERVER_URL=http://<ip-lan>:3000 npm run android:build:debug
```

Para un APK que apunte a produccion, usa el dominio HTTPS publicado:

```bash
CAPACITOR_SERVER_URL=https://<dominio-rutacero> npm run android:build:debug
```

Para el rollout serverless y el flujo de Google Pay en Android, ver [docs/serverless-google-pay-rollout.md](/Users/jnolasco/Desktop/PROYECTOS/Debt Control/app/docs/serverless-google-pay-rollout.md).

## Calidad
```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:security
npm run build
```

Ejecutar todo:
```bash
npm run check
```

## E2E (login)
Instalar navegador de Playwright (una vez):
```bash
npx playwright install chromium
```

Ejecutar smoke E2E de login usuario/admin:
```bash
npm run test:e2e:login
```

Ejecutar toda la bateria (unit + e2e):
```bash
npm run test:all
```

## Health checks
- Liveness: `GET /api/healthz`
- Readiness: `GET /api/readiness`

## Seguridad de login
- Rate-limit por IP y por cuenta para `/login` y `/admin/login`.
- Bloqueo progresivo por intentos fallidos (persistido en DB):
  3 fallos: 1 min, 5: 5 min, 7: 15 min, 10: 1 h, 14: 24 h.

## Multi-tenant
- Aislamiento por `tenant_id` en tablas y consultas.
- Tenant activo por workspace (`user_profiles.current_tenant_id`).
- Billing por tenant.

## Recomendaciones de plan (v2)
El motor de plan ahora usa:
- objetivo del usuario (`FASTEST`, `LEAST_INTEREST`, `BALANCED`)
- motivación y tolerancia al riesgo (configuración)
- buffer de seguridad para evitar planes irreales
- modelado de interés más preciso por deuda (`interest_model`, `payment_day`, `monthly_fees`)

## Notas importantes de entorno local
- `.env.local` no se versiona.
- `supabase/config.toml` quedó en `localhost/127.0.0.1` para evitar romperse por IP DHCP.
- SMTP de Supabase local está desactivado por defecto para evitar envíos reales accidentales.

## CI
Pipeline en `.github/workflows/ci.yml`:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run test:security`
- `npm run build`
- `npm audit --omit=dev`

## Operacion local (backup / restore)
Crear backup local:
```bash
npm run backup:local
```

Restaurar backup local (resetea DB local primero):
```bash
npm run restore:local -- ./backups/supabase_local_data_YYYYMMDD_HHMMSS.sql
```

Validar restore:
```bash
npm run verify:restore
```

Preflight completo de smoke local:
```bash
npm run verify:smoke:local
```

Runbook detallado: `BACKUP_RESTORE_RUNBOOK.md`

## Seguridad adicional implementada
- Bloqueo progresivo de login para usuario y admin.
- Desbloqueo manual desde `/admin/settings`.
- Cron de mantenimiento: `GET|POST /api/cron/security-maintenance` (requiere `Bearer CRON_SECRET`).
- MFA TOTP opcional para admin (`ADMIN_MFA_TOTP_SECRET`).
- Rotación de contraseña admin por antigüedad (`ADMIN_PASSWORD_MAX_AGE_DAYS`).
- Observabilidad opcional hacia webhook externo (`OBSERVABILITY_WEBHOOK_URL`).
