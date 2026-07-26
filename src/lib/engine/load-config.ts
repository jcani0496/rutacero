'use server';

import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import {
    DEFAULT_ENGINE_CONFIG,
    parseEngineConstraints,
    parseHybridWeights,
    type ResolvedEngineConfig,
} from '@/lib/engine/config';
import { logger } from '@/lib/logger';

let cachedActiveConfig: { config: ResolvedEngineConfig; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function mapRowToConfig(row: {
    version: string;
    weights: unknown;
    constraints: unknown;
}): ResolvedEngineConfig {
    return {
        version: row.version,
        source: 'database',
        weights: parseHybridWeights(row.weights),
        constraints: parseEngineConstraints(row.constraints),
    };
}

/** Load ACTIVE engine config from DB, falling back to hardcoded defaults. */
export async function getActiveEngineConfig(): Promise<ResolvedEngineConfig> {
    if (cachedActiveConfig && Date.now() - cachedActiveConfig.loadedAt < CACHE_TTL_MS) {
        return cachedActiveConfig.config;
    }

    try {
        const db = getDb();
        const [row] = await db
            .select({
                version: schema.engineConfigs.version,
                weights: schema.engineConfigs.weights,
                constraints: schema.engineConfigs.constraints,
            })
            .from(schema.engineConfigs)
            .where(eq(schema.engineConfigs.status, 'ACTIVE'))
            .orderBy(desc(schema.engineConfigs.activatedAt))
            .limit(1);

        if (!row) {
            cachedActiveConfig = { config: DEFAULT_ENGINE_CONFIG, loadedAt: Date.now() };
            return DEFAULT_ENGINE_CONFIG;
        }

        const config = mapRowToConfig(row);
        cachedActiveConfig = { config, loadedAt: Date.now() };
        return config;
    } catch (error) {
        logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            '[engine-config] Failed to load ACTIVE config; using defaults',
        );
        return DEFAULT_ENGINE_CONFIG;
    }
}

/** Bust in-process cache after admin activates a new config. */
export async function invalidateActiveEngineConfigCache(): Promise<void> {
    cachedActiveConfig = null;
}
