'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb, schema } from '@/db/client';
import { logAdminAction, requireAdminAuth, requirePermission, type AdminSession } from '@/lib/actions/admin-auth';
import {
    DEFAULT_ENGINE_CONSTRAINTS,
    DEFAULT_HYBRID_WEIGHTS,
    parseEngineConstraints,
    parseHybridWeights,
    validateEngineConstraints,
    validateHybridWeights,
    type EngineConstraints,
    type HybridEngineWeights,
} from '@/lib/engine/config';
import { getActiveEngineConfig, invalidateActiveEngineConfigCache } from '@/lib/engine/load-config';
import { logger } from '@/lib/logger';

export interface EngineConfigRow {
    id: string;
    version: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    weights: HybridEngineWeights;
    constraints: EngineConstraints;
    created_by_admin_id: string;
    created_at: string;
    activated_at: string | null;
}

export interface EngineConfigSummary {
    active: {
        version: string;
        source: 'default' | 'database';
        weights: HybridEngineWeights;
        constraints: EngineConstraints;
        activated_at: string | null;
    };
    drafts: EngineConfigRow[];
}

function mapConfigRow(row: {
    id: string;
    version: string;
    status: string;
    weights: unknown;
    constraints: unknown;
    createdByAdminId: string;
    createdAt: Date;
    activatedAt: Date | null;
}): EngineConfigRow {
    return {
        id: row.id,
        version: row.version,
        status: row.status as EngineConfigRow['status'],
        weights: parseHybridWeights(row.weights),
        constraints: parseEngineConstraints(row.constraints),
        created_by_admin_id: row.createdByAdminId,
        created_at: row.createdAt.toISOString(),
        activated_at: row.activatedAt?.toISOString() ?? null,
    };
}

async function requireSuperAdmin(): Promise<AdminSession> {
    const session = await requireAdminAuth();
    if (session.role !== 'SUPER_ADMIN') {
        throw new Error('Permission denied: SUPER_ADMIN required');
    }
    return session;
}

export async function getEngineConfigSummary(): Promise<EngineConfigSummary> {
    await requirePermission('settings:read');

    const activeConfig = await getActiveEngineConfig();
    let drafts: EngineConfigRow[] = [];
    let activeActivatedAt: string | null = null;

    try {
        const db = getDb();

        if (activeConfig.source === 'database') {
            const [activeRow] = await db
                .select({ activatedAt: schema.engineConfigs.activatedAt })
                .from(schema.engineConfigs)
                .where(eq(schema.engineConfigs.status, 'ACTIVE'))
                .orderBy(desc(schema.engineConfigs.activatedAt))
                .limit(1);
            activeActivatedAt = activeRow?.activatedAt?.toISOString() ?? null;
        }

        const rows = await db
            .select({
                id: schema.engineConfigs.id,
                version: schema.engineConfigs.version,
                status: schema.engineConfigs.status,
                weights: schema.engineConfigs.weights,
                constraints: schema.engineConfigs.constraints,
                createdByAdminId: schema.engineConfigs.createdByAdminId,
                createdAt: schema.engineConfigs.createdAt,
                activatedAt: schema.engineConfigs.activatedAt,
            })
            .from(schema.engineConfigs)
            .where(eq(schema.engineConfigs.status, 'DRAFT'))
            .orderBy(desc(schema.engineConfigs.createdAt));

        drafts = rows.map(mapConfigRow);
    } catch (error) {
        logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            '[engine-config] Failed to list drafts',
        );
    }

    return {
        active: {
            version: activeConfig.version,
            source: activeConfig.source,
            weights: activeConfig.weights,
            constraints: activeConfig.constraints,
            activated_at: activeActivatedAt,
        },
        drafts,
    };
}

export async function createDraftEngineConfig(input?: {
    version?: string;
    weights?: HybridEngineWeights;
    constraints?: EngineConstraints;
}): Promise<{ success: boolean; error?: string; config?: EngineConfigRow }> {
    const session = await requireSuperAdmin();

    const version = (input?.version || `draft-${Date.now()}`).trim().slice(0, 20);
    if (!version) {
        return { success: false, error: 'Versión inválida.' };
    }

    const weights = input?.weights ?? DEFAULT_HYBRID_WEIGHTS;
    const constraints = input?.constraints ?? DEFAULT_ENGINE_CONSTRAINTS;

    const weightError = validateHybridWeights(weights);
    if (weightError) return { success: false, error: weightError };

    const constraintError = validateEngineConstraints(constraints);
    if (constraintError) return { success: false, error: constraintError };

    const db = getDb();

    const [existingVersion] = await db
        .select({ id: schema.engineConfigs.id })
        .from(schema.engineConfigs)
        .where(eq(schema.engineConfigs.version, version))
        .limit(1);

    if (existingVersion) {
        return { success: false, error: 'Ya existe una configuración con esa versión.' };
    }

    try {
        const [row] = await db
            .insert(schema.engineConfigs)
            .values({
                version,
                status: 'DRAFT',
                weights,
                constraints,
                createdByAdminId: session.adminId,
            })
            .returning({
                id: schema.engineConfigs.id,
                version: schema.engineConfigs.version,
                status: schema.engineConfigs.status,
                weights: schema.engineConfigs.weights,
                constraints: schema.engineConfigs.constraints,
                createdByAdminId: schema.engineConfigs.createdByAdminId,
                createdAt: schema.engineConfigs.createdAt,
                activatedAt: schema.engineConfigs.activatedAt,
            });

        if (!row) {
            return { success: false, error: 'No se pudo crear el borrador.' };
        }

        await logAdminAction(session.adminId, 'CREATE_ENGINE_CONFIG_DRAFT', 'engine_configs', row.id, {
            version,
        });

        revalidatePath('/admin/settings');
        return { success: true, config: mapConfigRow(row) };
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            '[engine-config] createDraft failed',
        );
        return { success: false, error: 'No se pudo crear el borrador.' };
    }
}

export async function updateDraftEngineConfig(input: {
    id: string;
    version?: string;
    weights: HybridEngineWeights;
    constraints: EngineConstraints;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requireSuperAdmin();

    const weightError = validateHybridWeights(input.weights);
    if (weightError) return { success: false, error: weightError };

    const constraintError = validateEngineConstraints(input.constraints);
    if (constraintError) return { success: false, error: constraintError };

    const db = getDb();
    const [draft] = await db
        .select({
            id: schema.engineConfigs.id,
            status: schema.engineConfigs.status,
            version: schema.engineConfigs.version,
        })
        .from(schema.engineConfigs)
        .where(eq(schema.engineConfigs.id, input.id))
        .limit(1);

    if (!draft || draft.status !== 'DRAFT') {
        return { success: false, error: 'Solo se pueden editar borradores.' };
    }

    const nextVersion = input.version?.trim().slice(0, 20) || draft.version;
    if (!nextVersion) {
        return { success: false, error: 'Versión inválida.' };
    }

    if (nextVersion !== draft.version) {
        const [existingVersion] = await db
            .select({ id: schema.engineConfigs.id })
            .from(schema.engineConfigs)
            .where(eq(schema.engineConfigs.version, nextVersion))
            .limit(1);

        if (existingVersion) {
            return { success: false, error: 'Ya existe una configuración con esa versión.' };
        }
    }

    try {
        await db
            .update(schema.engineConfigs)
            .set({
                version: nextVersion,
                weights: input.weights,
                constraints: input.constraints,
            })
            .where(eq(schema.engineConfigs.id, input.id));

        await logAdminAction(session.adminId, 'UPDATE_ENGINE_CONFIG_DRAFT', 'engine_configs', input.id, {
            version: nextVersion,
        });

        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            '[engine-config] updateDraft failed',
        );
        return { success: false, error: 'No se pudo actualizar el borrador.' };
    }
}

export async function activateEngineConfig(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await requireSuperAdmin();
    const db = getDb();

    const [target] = await db
        .select({
            id: schema.engineConfigs.id,
            status: schema.engineConfigs.status,
            version: schema.engineConfigs.version,
        })
        .from(schema.engineConfigs)
        .where(eq(schema.engineConfigs.id, id))
        .limit(1);

    if (!target) {
        return { success: false, error: 'Configuración no encontrada.' };
    }

    if (target.status === 'ACTIVE') {
        return { success: false, error: 'Esta configuración ya está activa.' };
    }

    if (target.status !== 'DRAFT') {
        return { success: false, error: 'Solo se pueden activar borradores.' };
    }

    const now = new Date();

    try {
        await db.transaction(async (tx) => {
            await tx
                .update(schema.engineConfigs)
                .set({ status: 'ARCHIVED' })
                .where(eq(schema.engineConfigs.status, 'ACTIVE'));

            await tx
                .update(schema.engineConfigs)
                .set({ status: 'ACTIVE', activatedAt: now })
                .where(eq(schema.engineConfigs.id, id));
        });

        await invalidateActiveEngineConfigCache();

        await logAdminAction(session.adminId, 'ACTIVATE_ENGINE_CONFIG', 'engine_configs', id, {
            version: target.version,
        });

        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            '[engine-config] activate failed',
        );
        return { success: false, error: 'No se pudo activar la configuración.' };
    }
}

export async function seedDefaultActiveEngineConfig(): Promise<void> {
    const session = await requireSuperAdmin();
    const db = getDb();

    const [existingActive] = await db
        .select({ id: schema.engineConfigs.id })
        .from(schema.engineConfigs)
        .where(eq(schema.engineConfigs.status, 'ACTIVE'))
        .limit(1);

    if (existingActive) return;

    await db.insert(schema.engineConfigs).values({
        version: '1.0',
        status: 'ACTIVE',
        weights: DEFAULT_HYBRID_WEIGHTS,
        constraints: DEFAULT_ENGINE_CONSTRAINTS,
        createdByAdminId: session.adminId,
        activatedAt: new Date(),
    });

    await invalidateActiveEngineConfigCache();
}
