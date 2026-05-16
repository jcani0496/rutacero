/**
 * Movimientos MVP — multi-granularity cashflow timeline.
 *
 * Pure types shared by buckets, aggregator, cache and server action.
 * No DB, no IO, no React deps.
 *
 * IMPORTANT (legal): All user-facing copy must be NEUTRAL and OBSERVATIONAL.
 * Never prescriptive. This module does not constitute financial advice.
 */

/**
 * The seven granularities the user can toggle between. URL slugs are the
 * Spanish names so the URL stays self-explanatory for Guatemalan users.
 */
export type Granularity =
    | 'diario'
    | 'semanal'
    | 'quincenal'
    | 'mensual'
    | 'trimestral'
    | 'semestral'
    | 'anual';

export const GRANULARITIES: readonly Granularity[] = [
    'diario',
    'semanal',
    'quincenal',
    'mensual',
    'trimestral',
    'semestral',
    'anual',
] as const;

export const DEFAULT_GRANULARITY: Granularity = 'mensual';

/**
 * Number of buckets each granularity renders (counted backward from "now",
 * inclusive of the current bucket).
 */
export const BUCKET_COUNT: Record<Granularity, number> = {
    diario: 90,
    semanal: 26,
    quincenal: 12,
    mensual: 12,
    trimestral: 8,
    semestral: 6,
    anual: 5,
};

/**
 * Source of a raw movement row. We keep `essential_expense` and
 * `debt_payment` separate so the UI/aggregator can decide to merge them or
 * present separately. The aggregator currently sums both into the "expense"
 * series, by design — see README in this folder.
 */
export type MovementSource = 'income' | 'essential_expense' | 'debt_payment';

/**
 * A single raw movement passed to the pure aggregator. The aggregator never
 * touches Supabase — callers normalize their queries into this shape.
 */
export interface RawMovement {
    /** ISO date, YYYY-MM-DD (or any string parseable by Date). */
    date: string;
    /** Amount in user's base currency (positive number). */
    amount: number;
    source: MovementSource;
}

/**
 * A single time bucket, what we feed to Recharts as a row.
 */
export interface MovimientosBucket {
    /** Stable bucket key, e.g. "2026-03" for mensual, "2026-W12" for semanal. */
    key: string;
    /** ISO timestamp for the START of the bucket — useful for sorting / x-axis. */
    bucketStart: string;
    /** ISO timestamp for the END of the bucket (inclusive). */
    bucketEnd: string;
    /** Short Spanish label shown on the X axis, e.g. "Mar", "Sem 12". */
    label: string;
    /** Long Spanish label shown in tooltips, e.g. "Marzo 2026". */
    longLabel: string;
    income: number;
    expense: number;
    /** balance = income - expense (kept precomputed for the line series). */
    balance: number;
    /** True if no movement (income or expense) was recorded in the bucket. */
    isEmpty: boolean;
}

/**
 * Aggregate totals across the entire window — fed to the hero KPI cards.
 */
export interface MovimientosTotals {
    income: number;
    expense: number;
    balance: number;
}

/**
 * Public result shape returned by `getMovimientos`. Pure data — UI is
 * responsible for rendering.
 */
export interface MovimientosResult {
    granularity: Granularity;
    /** ISO timestamp of the start of the window (inclusive). */
    windowStart: string;
    /** ISO timestamp of the end of the window (inclusive — usually "today"). */
    windowEnd: string;
    /** Sorted ascending by bucketStart. May contain empty buckets. */
    buckets: MovimientosBucket[];
    totals: MovimientosTotals;
    /** Currency code from user profile (typically "GTQ"). */
    currency: string;
    /** Number of raw movements that contributed to this result. */
    movementCount: number;
    /** True when at least one bucket has any movement. */
    hasData: boolean;
    /** ISO timestamp this result was computed at. */
    computedAt: string;
}
