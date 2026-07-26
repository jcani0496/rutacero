/**
 * Hybrid engine runtime config — mirrors the five weights implemented in engine.ts.
 * Unimplemented legacy keys (w_mora, w_util, w_behavior, w_fx) are ignored.
 */

export interface HybridEngineWeights {
    w_rate: number;
    w_balance: number;
    w_due: number;
    w_momentum: number;
    w_type: number;
}

export interface EngineConstraints {
    min_cash_buffer: number;
    max_simulation_periods: number;
    urgency_window_days: number;
    max_apr_cap: number;
}

export interface ResolvedEngineConfig {
    version: string;
    source: 'default' | 'database';
    weights: HybridEngineWeights;
    constraints: EngineConstraints;
}

export const DEFAULT_HYBRID_WEIGHTS: HybridEngineWeights = {
    w_rate: 0.30,
    w_balance: 0.30,
    w_due: 0.15,
    w_momentum: 0.15,
    w_type: 0.10,
};

export const DEFAULT_ENGINE_CONSTRAINTS: EngineConstraints = {
    min_cash_buffer: 0,
    max_simulation_periods: 600,
    urgency_window_days: 7,
    max_apr_cap: 80,
};

export const DEFAULT_ENGINE_CONFIG: ResolvedEngineConfig = {
    version: 'default',
    source: 'default',
    weights: DEFAULT_HYBRID_WEIGHTS,
    constraints: DEFAULT_ENGINE_CONSTRAINTS,
};

const WEIGHT_KEYS: (keyof HybridEngineWeights)[] = [
    'w_rate',
    'w_balance',
    'w_due',
    'w_momentum',
    'w_type',
];

const CONSTRAINT_KEYS: (keyof EngineConstraints)[] = [
    'min_cash_buffer',
    'max_simulation_periods',
    'urgency_window_days',
    'max_apr_cap',
];

function readNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** Parse weights JSON from DB, ignoring unimplemented legacy keys. */
export function parseHybridWeights(raw: unknown): HybridEngineWeights {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const parsed = {} as HybridEngineWeights;

    for (const key of WEIGHT_KEYS) {
        parsed[key] = readNumber(source[key], DEFAULT_HYBRID_WEIGHTS[key]);
    }

    return parsed;
}

export function parseEngineConstraints(raw: unknown): EngineConstraints {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const parsed = {} as EngineConstraints;

    for (const key of CONSTRAINT_KEYS) {
        parsed[key] = readNumber(source[key], DEFAULT_ENGINE_CONSTRAINTS[key]);
    }

    return parsed;
}

export function weightsSum(weights: HybridEngineWeights): number {
    return WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
}

export function validateHybridWeights(weights: HybridEngineWeights): string | null {
    for (const key of WEIGHT_KEYS) {
        const value = weights[key];
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            return `Peso inválido: ${key}`;
        }
    }

    const sum = weightsSum(weights);
    if (Math.abs(sum - 1) > 0.001) {
        return `Los pesos deben sumar 1.0 (actual: ${sum.toFixed(3)})`;
    }

    return null;
}

export function validateEngineConstraints(constraints: EngineConstraints): string | null {
    if (constraints.max_apr_cap <= 0 || constraints.max_apr_cap > 200) {
        return 'max_apr_cap debe estar entre 1 y 200';
    }
    if (constraints.urgency_window_days < 1 || constraints.urgency_window_days > 31) {
        return 'urgency_window_days debe estar entre 1 y 31';
    }
    if (constraints.max_simulation_periods < 12 || constraints.max_simulation_periods > 1200) {
        return 'max_simulation_periods debe estar entre 12 y 1200';
    }
    if (constraints.min_cash_buffer < 0) {
        return 'min_cash_buffer no puede ser negativo';
    }
    return null;
}

export function configCacheKey(config: ResolvedEngineConfig): string {
    const w = config.weights;
    const c = config.constraints;
    return [
        config.version,
        w.w_rate,
        w.w_balance,
        w.w_due,
        w.w_momentum,
        w.w_type,
        c.max_apr_cap,
        c.urgency_window_days,
        c.max_simulation_periods,
    ].join(':');
}
