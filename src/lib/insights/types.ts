/**
 * Insights MVP — deterministic, precomputed observations about a user's debts.
 *
 * IMPORTANT (legal): Every insight must be a NEUTRAL OBSERVATION, never a
 * prescription. Forbidden words include: "recomendamos", "deberías",
 * "conviene", "te aconsejo", "lo mejor es". Preferred phrasing: "una opción
 * es", "podrías considerar", "se observa", "actualmente", "según tus datos".
 */

export type InsightCategory = 'cost' | 'composition' | 'calendar' | 'whatif';
export type InsightSeverity = 'info' | 'positive' | 'attention';

export interface Insight {
    /** Stable id for tracking, e.g. 'cost-monthly-interest'. */
    id: string;
    category: InsightCategory;
    severity: InsightSeverity;
    /** Short Spanish title — neutral, observational. */
    title: string;
    /** 1-3 sentence Spanish body — neutral, observational. */
    body: string;
    cta?: { label: string; href: string };
    /** ISO timestamp the insight was computed at. */
    computedAt: string;
}

export interface InsightsResult {
    /** Ranked, capped at the caller's maxInsights. */
    insights: Insight[];
    /** Total active debts considered (metadata for the caller UI). */
    totalDebts: number;
    /**
     * False when the user has no active debts. Callers should hide the
     * insights section entirely in that case.
     */
    hasData: boolean;
}

/**
 * Minimal shape of a debt row passed into pure generators. We intentionally
 * narrow to the fields the generators need, so generators are easy to test
 * with stub data and decoupled from the wider Supabase row type.
 */
export interface DebtSnapshot {
    id: string;
    creditor: string;
    /** Outstanding principal in the debt's currency. */
    balance: number;
    /** Annual percentage rate (e.g. 24 means 24%). May be null/zero. */
    apr: number | null;
    /** Minimum monthly payment. */
    minPayment: number;
    /** Day of month the payment is due (1-31). Optional. */
    paymentDay: number | null;
    /** Next scheduled payment date (ISO date, YYYY-MM-DD). */
    nextPaymentDate: string;
    /** Currency code (typically 'GTQ'). */
    currency: string;
    /** Debt type label, e.g. 'TARJETA_CREDITO'. */
    type: string;
}

/**
 * Common context every generator receives. Pure: no DB, no IO.
 */
export interface GeneratorContext {
    debts: DebtSnapshot[];
    /** ISO timestamp considered "now" — injectable for testability. */
    computedAt: string;
}

export type InsightGenerator = (ctx: GeneratorContext) => Insight[];
