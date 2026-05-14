# Migration Deployment to Production

Este doc cubre cómo las migrations de Supabase llegan a producción **automáticamente** cuando se mergea a main, y qué hacer si algo falla.

## Resumen

- Cada push a `main` que toca `supabase/migrations/**` dispara el workflow `.github/workflows/migrate-prod.yml`.
- El workflow corre `supabase db push --linked --include-all` contra el proyecto de producción.
- Si falla, **el deploy de Vercel sigue ejecutándose igual** (workflows son independientes). Eso significa que código que dependa de una migration nueva puede aterrizar en prod antes de que la columna exista. Mitigar con el orden de operaciones en §5.

## 1. Secrets requeridos en GitHub

Configurá los 3 en **Repo → Settings → Secrets and variables → Actions**:

| Secret | Cómo obtenerlo |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → "Generate new token" → name: `rutacero-ci-migrate`, scope: el necesario para manejar el proyecto. |
| `SUPABASE_DB_PASSWORD` | Dashboard del proyecto → Settings → Database → "Database password" (la que pusiste al crear el proyecto). Si la perdiste, regenerás una nueva ahí mismo. |
| `SUPABASE_PROJECT_REF` | El ref del proyecto (ej. `ywykusubhssoayrzptcp`). Aparece en la URL del dashboard. **Técnicamente no es secreto** pero lo guardamos como tal por consistencia. |

## 2. Workflow trigger

El workflow corre cuando:
- Cualquier commit aterriza en `main` y el cambio incluye archivos bajo `supabase/migrations/`.
- Vos lo disparás manualmente desde **Actions → Apply Supabase migrations to production → Run workflow**.

NO corre en PRs (demasiado riesgoso aplicar migrations especulativas a producción).

## 3. Qué hace el workflow

1. Linkea al proyecto de producción usando `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`.
2. Lista el estado pre-push (qué migrations ya están aplicadas).
3. Corre `supabase db push --linked --include-all` que aplica TODAS las migrations locales que aún no están en remote.
4. Lista el estado post-push para confirmar.

El comando es idempotente: si todas las migrations ya estaban aplicadas, no hace nada y termina con éxito.

## 4. Si el workflow falla

Posibles causas, ordenadas por probabilidad:

### 4.1 Migration con SQL inválido

El workflow se detiene en la primera migration que falla. El log de Actions muestra el error de Postgres exacto. **No se aplican las migrations siguientes** del batch.

**Recuperación**:
1. Identificar la migration que falló en el log.
2. **NO modificar el archivo de migration existente** (eso causaría drift entre dev y prod).
3. Crear una nueva migration `0XX_fix_<descripcion>.sql` que arregle el problema.
4. Mergear a main → el workflow corre de nuevo y aplica TODAS las migrations pendientes (la rota incluida, ahora reparada por la siguiente).
5. Si la migration rota dejó la DB en estado inconsistente, intervenir manualmente en Supabase Studio SQL Editor.

### 4.2 Conflicto de schema

Si alguien aplicó cambios manualmente en Supabase Studio que conflictan con una migration del repo, `db push` falla con "table already exists" o similar.

**Recuperación**:
1. Revisar qué se aplicó manualmente fuera del repo (ver historial de cambios en Supabase Dashboard si está habilitado).
2. Crear una migration que reconcilie el estado (`CREATE TABLE IF NOT EXISTS`, etc.).
3. O bien, ejecutar manualmente las migrations pendientes vía Supabase Studio y marcarlas como aplicadas en `supabase_migrations.schema_migrations` directamente. **Avanzado y peligroso** — preferir 1+2.

### 4.3 Credenciales inválidas

El workflow falla en el step "Link to production project" con error de autenticación.

**Recuperación**:
1. Regenerar `SUPABASE_ACCESS_TOKEN` desde el dashboard de Supabase.
2. Actualizar el secret en GitHub.
3. Re-disparar el workflow manualmente.

### 4.4 Supabase project suspendido

Si el proyecto está pausado (plan free pausa proyectos inactivos), el push falla con timeout de conexión.

**Recuperación**: restaurar el proyecto desde el dashboard de Supabase, luego re-disparar el workflow.

## 5. Orden de operaciones para shipping cambios con migrations

**Tradeoff fundamental**: las migrations se aplican en paralelo con el deploy de Vercel. Si el código del PR depende de una columna nueva, hay una ventana de unos minutos donde el código está vivo y la columna no existe.

**Patrón recomendado para migrations que agregan campos requeridos por nuevo código:**

1. PR 1: solo la migration. Mergear. Esperar que `migrate-prod` complete con éxito (verificar en Actions tab).
2. PR 2: el código que usa el nuevo campo. Mergear cuando el ambiente ya tenga la columna.

**Patrón aceptable para migrations idempotentes con campos opcionales:**

1. PR único con migration + código. La migration aplica antes (típicamente <30s); el deploy de Vercel toma 2-3min. En la práctica la columna existe cuando el deploy termina, pero NO está garantizado.

**Anti-patrón conocido (lo que pasó con `onboarding_motivation` en mayo 2026):**

- Mergear PR con código que escribe una columna nueva, **sin mecanismo de migration deploy**. Resultado: el código aterriza en prod, intenta escribir la columna, falla silenciosamente, usuarios bloqueados.

## 6. Rollback de migrations

Postgres no tiene "rollback automático" de migrations. Si una migration produce daño:

1. **Snapshot inmediato**: corré `npm run backup:prod` (ver `docs/operational/backup-runbook.md`) para tener un punto de restauración con la versión rota, por si ayuda en el post-mortem.
2. **Crear migration inversa**: por ejemplo, `0XY_revert_onboarding_motivation.sql` con `ALTER TABLE ... DROP COLUMN IF EXISTS ...`.
3. **Mergear a main**: el workflow la aplica.
4. **Restaurar datos si los hay**: si la migration borró/transformó datos, restaurá desde el backup mensual o el manual recién tomado.

## 7. Verificación post-merge

Después de mergear cualquier PR que toque `supabase/migrations/`:

1. Ir a Actions → "Apply Supabase migrations to production" → último run debe estar verde.
2. Hacer smoke test en producción de la feature que depende de la migration.
3. Si el workflow falla, **antes de hacer otro merge**, resolver el problema (sección 4).

## 8. Última revisión

2026-05-14 — Founder
