import type { GoalType, PlanStrategy } from '@/types';

/**
 * Deterministic onboarding goal → plan strategy mapping (Fase B).
 * FASTEST → SNOWBALL, LEAST_INTEREST → AVALANCHE, BALANCED → HYBRID.
 */
export function goalTypeToStrategy(goalType: GoalType | null | undefined): PlanStrategy {
    switch (goalType) {
        case 'FASTEST':
            return 'SNOWBALL';
        case 'LEAST_INTEREST':
            return 'AVALANCHE';
        case 'BALANCED':
        default:
            return 'HYBRID';
    }
}

export function goalTypeLabel(goalType: GoalType | null | undefined): string {
    switch (goalType) {
        case 'FASTEST':
            return 'salir lo más rápido posible';
        case 'LEAST_INTEREST':
            return 'pagar menos intereses';
        case 'BALANCED':
        default:
            return 'un balance entre rapidez y ahorro';
    }
}

export function strategyLabel(strategy: PlanStrategy): string {
    switch (strategy) {
        case 'SNOWBALL':
            return 'Bola de Nieve';
        case 'AVALANCHE':
            return 'Avalancha';
        case 'HYBRID':
            return 'Híbrido';
        default:
            return strategy;
    }
}

/** Copy for plan UI: “Según lo que elegiste…” */
export function goalStrategyReason(goalType: GoalType | null | undefined): string {
    const goal = goalTypeLabel(goalType);
    const strategy = strategyLabel(goalTypeToStrategy(goalType));
    return `Según lo que elegiste (${goal}), te sugerimos ${strategy}.`;
}
