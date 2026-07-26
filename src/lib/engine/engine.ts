// Debt Payoff Calculation Engine
// Implements Avalanche, Snowball, and Hybrid strategies

import type { Debt, GoalType } from '@/types';
import { goalStrategyReason, goalTypeToStrategy } from '@/lib/plans/goal-strategy';
import type {
    PayoffStrategy,
    PayoffInput,
    PayoffPlan,
    DebtWithPriority,
    PayoffStep,
    PaymentAllocation,
    DebtSnapshot,
    PayoffSummary,
    RationaleBreakdown,
    RationaleFactor,
    PlanComparison,
} from './types';
import {
    configCacheKey,
    DEFAULT_ENGINE_CONFIG,
    type ResolvedEngineConfig,
} from './config';

const ENGINE_VERSION = '2.1.0';

export { ENGINE_VERSION };
export type { ResolvedEngineConfig };

/**
 * Balances below this threshold (half a centavo) are treated as fully paid.
 * Keeps floating-point crumbs from holding a debt "active" after payoff.
 */
const PAYOFF_EPSILON = 0.005;

export type PaymentTimingAssumption = 'DUE_DAY' | 'FIRST_DAY' | 'LAST_DAY';

export interface EngineOptions {
    paymentTiming?: PaymentTimingAssumption;
    engineConfig?: ResolvedEngineConfig;
}

// Memoization cache for expensive calculations (PERF-004 remediation)
const calculationCache = new Map<string, PayoffPlan>();
const MAX_CACHE_SIZE = 100;

// ============================================
// CACHE HELPERS
// ============================================

/**
 * Generates a cache key for memoization
 * PERF-004: Memoize expensive engine calculations
 *
 * Must include EVERYTHING that changes the simulation output. Omitting
 * options.paymentTiming made the FIRST_DAY/LAST_DAY sensitivity runs in
 * comparePlansPersonalized return the cached DUE_DAY plan, collapsing the
 * optimistic/pessimistic range to a single value for daily-interest debts.
 * ENGINE_VERSION is included so long-lived processes never serve plans
 * computed by an older engine.
 */
function generateCacheKey(
    input: PayoffInput,
    maxIterations: number,
    options?: EngineOptions,
    engineConfig?: ResolvedEngineConfig,
): string {
    // Sort debts by ID for consistent key generation
    const sortedDebts = [...input.debts].sort((a, b) => a.id.localeCompare(b.id));

    // Create a deterministic string representation
    const debtsHash = sortedDebts
        .map(d => `${d.id}:${d.balance}:${d.apr}:${d.min_payment}:${d.interest_model || ''}:${d.payment_day || ''}:${d.due_date || ''}:${d.monthly_fees || 0}`)
        .join('|');

    const timing = options?.paymentTiming || 'DUE_DAY';
    const configKey = configCacheKey(engineConfig ?? DEFAULT_ENGINE_CONFIG);
    return `${ENGINE_VERSION}:${configKey}:${input.strategy}:${input.monthlyBudget}:${timing}:${maxIterations}:${debtsHash}`;
}

/**
 * Clears old cache entries if cache is too large
 */
function cleanCache(): void {
    if (calculationCache.size > MAX_CACHE_SIZE) {
        // Remove oldest 20% of entries
        const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        const keys = Array.from(calculationCache.keys());

        for (let i = 0; i < entriesToRemove; i++) {
            calculationCache.delete(keys[i]);
        }
    }
}

// ============================================
// MAIN ENGINE FUNCTION
// ============================================

export function calculatePayoffPlan(
    input: PayoffInput,
    maxIterations?: number,
    options?: EngineOptions
): PayoffPlan {
    const engineConfig = options?.engineConfig ?? DEFAULT_ENGINE_CONFIG;
    const iterationLimit = maxIterations ?? engineConfig.constraints.max_simulation_periods;

    // Check cache first (PERF-004 remediation)
    const cacheKey = generateCacheKey(input, iterationLimit, options, engineConfig);
    const cached = calculationCache.get(cacheKey);

    if (cached) {
        // Return cached result with updated timestamp
        return {
            ...cached,
            generatedAt: new Date(),
        };
    }

    const { debts, monthlyBudget, strategy } = input;

    if (debts.length === 0) {
        throw new Error('No debts provided');
    }

    if (monthlyBudget <= 0) {
        throw new Error('Monthly budget must be positive');
    }

    // VUL-010: Validate debt inputs to prevent infinite loops
    for (const debt of debts) {
        const balance = Number(debt.balance);
        const minPayment = Number(debt.min_payment);
        const apr = Number(debt.apr);

        // Prevent infinite loop scenarios
        if (balance > 0 && minPayment <= 0) {
            throw new Error(
                `Invalid debt configuration: Debt "${debt.creditor}" has balance but no minimum payment. This would cause infinite calculation.`
            );
        }

        if (balance > 0 && apr === 0 && minPayment <= 0) {
            throw new Error(
                `Invalid debt configuration: Debt "${debt.creditor}" has 0% APR and no minimum payment. Cannot calculate payoff.`
            );
        }
    }

    // Calculate total minimum payments
    const totalMinPayments = debts.reduce((sum, d) => sum + Number(d.min_payment), 0);

    if (monthlyBudget < totalMinPayments) {
        throw new Error(`Budget (${monthlyBudget}) is less than minimum payments (${totalMinPayments})`);
    }

    // Prioritize debts based on strategy
    const prioritizedDebts = prioritizeDebts(debts, strategy, engineConfig);

    // Generate payment timeline with iteration limit
    const timeline = generateTimeline(prioritizedDebts, monthlyBudget, iterationLimit, options);

    // Calculate summary
    const summary = calculateSummary(prioritizedDebts, timeline);

    const result: PayoffPlan = {
        strategy,
        engineVersion: ENGINE_VERSION,
        generatedAt: new Date(),
        debts: prioritizedDebts,
        timeline,
        summary,
    };

    // Cache the result
    calculationCache.set(cacheKey, result);
    cleanCache();

    return result;
}

// ============================================
// PRIORITIZATION ALGORITHMS
// ============================================

function prioritizeDebts(
    debts: Debt[],
    strategy: PayoffStrategy,
    engineConfig: ResolvedEngineConfig,
): DebtWithPriority[] {
    const debtsWithScores = debts.map(debt => {
        const score = calculatePriorityScore(debt, strategy, engineConfig);
        const rationale = generateRationale(debt, strategy);

        return {
            ...debt,
            priorityOrder: 0,
            priorityScore: score,
            rationale,
        };
    });

    // Sort by score (higher = higher priority)
    debtsWithScores.sort((a, b) => b.priorityScore - a.priorityScore);

    // Assign priority order
    return debtsWithScores.map((debt, index) => ({
        ...debt,
        priorityOrder: index + 1,
    }));
}

function calculatePriorityScore(
    debt: Debt,
    strategy: PayoffStrategy,
    engineConfig: ResolvedEngineConfig,
): number {
    const balance = Number(debt.balance);
    const apr = Number(debt.apr) || 0;
    const minPayment = Number(debt.min_payment);

    switch (strategy) {
        case 'AVALANCHE':
            // Pure APR ranking - higher APR = higher priority
            return apr * 100;

        case 'SNOWBALL':
            // Inverse balance - lower balance = higher priority
            // Use 1/balance scaled to avoid division issues
            return balance > 0 ? (100000 / balance) : 0;

        case 'HYBRID': {
            const { weights, constraints } = engineConfig;
            const W_RATE = weights.w_rate;
            const W_BALANCE = weights.w_balance;
            const W_DUE = weights.w_due;
            const W_MOMENTUM = weights.w_momentum;
            const W_TYPE = weights.w_type;

            const MAX_APR_CAP = constraints.max_apr_cap;
            const URGENCY_WINDOW_DAYS = constraints.urgency_window_days;

            // norm_rate: apr / max_apr_cap, capped at 1.0
            const normRate = Math.min(apr / MAX_APR_CAP, 1.0);

            // norm_balance: (1 - balance/maxBalance) for snowball effect
            // Using inverse scale - smaller balances get higher score
            const maxBalance = 100000; // Reasonable cap for normalization
            const normBalance = 1 - Math.min(balance / maxBalance, 1.0);

            // norm_due_urgency: based on days to due date
            let normDueUrgency = 0;
            if (debt.due_date) {
                const today = new Date();
                const dueDay = debt.due_date;
                const currentDay = today.getDate();
                const daysUntilDue = dueDay >= currentDay
                    ? dueDay - currentDay
                    : (30 - currentDay) + dueDay; // Wrap to next month
                normDueUrgency = 1 - Math.min(daysUntilDue / URGENCY_WINDOW_DAYS, 1.0);
            }

            // norm_momentum: higher when min payment can clear balance faster
            const normMomentum = balance > 0
                ? Math.min((minPayment / balance) * 12, 1.0)
                : 0;

            // type_boost: small boost for certain debt types
            let typeBoost = 0;
            if (debt.type === 'CREDIT_CARD') typeBoost = 0.3; // Cards compound aggressively
            if (debt.type === 'INSTALLMENT') typeBoost = 0.2; // Fixed term helps
            if (debt.type === 'INFORMAL') typeBoost = 0.4; // Preserve relationships

            // Calculate final score (normalized to ~0-100 range)
            const score = (
                W_RATE * normRate +
                W_BALANCE * normBalance +
                W_DUE * normDueUrgency +
                W_MOMENTUM * normMomentum +
                W_TYPE * typeBoost
            ) * 100;

            // Add small tiebreaker based on months to payoff (quick wins)
            const monthsToPayoff = balance / (minPayment || 1);
            const quickWinBonus = monthsToPayoff <= 6 ? 4 : monthsToPayoff <= 12 ? 2 : 0;

            return score + quickWinBonus;
        }

        default:
            return 0;
    }
}

// ============================================
// RATIONALE GENERATION
// ============================================

function generateRationale(debt: Debt, strategy: PayoffStrategy): RationaleBreakdown {
    const balance = Number(debt.balance);
    const apr = Number(debt.apr);
    const minPayment = Number(debt.min_payment);
    const monthsToPayoff = Math.ceil(balance / (minPayment || 1));

    const factors: RationaleFactor[] = [];

    switch (strategy) {
        case 'AVALANCHE':
            factors.push({
                name: 'Tasa de Interés',
                value: `${apr}%`,
                weight: 1.0,
                impact: apr >= 40 ? 'NEGATIVE' : apr >= 20 ? 'NEUTRAL' : 'POSITIVE',
                explanation: apr >= 40
                    ? 'Tasa muy alta, prioridad máxima para minimizar intereses'
                    : apr >= 20
                        ? 'Tasa moderada, pagar pronto reduce costos'
                        : 'Tasa baja, menor urgencia',
            });
            break;

        case 'SNOWBALL':
            factors.push({
                name: 'Saldo Actual',
                value: balance.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' }),
                weight: 1.0,
                impact: balance <= 2000 ? 'POSITIVE' : balance <= 10000 ? 'NEUTRAL' : 'NEGATIVE',
                explanation: balance <= 2000
                    ? 'Saldo bajo, win rápido para momentum'
                    : balance <= 10000
                        ? 'Saldo moderado'
                        : 'Saldo alto, tomará más tiempo eliminar',
            });
            break;

        case 'HYBRID':
            factors.push(
                {
                    name: 'Tasa de Interés',
                    value: `${apr}%`,
                    weight: 0.3,
                    impact: apr >= 30 ? 'NEGATIVE' : apr >= 15 ? 'NEUTRAL' : 'POSITIVE',
                    explanation: `${apr >= 30 ? 'Alta' : apr >= 15 ? 'Moderada' : 'Baja'} - prioridad por costo`,
                },
                {
                    name: 'Saldo',
                    value: balance.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' }),
                    weight: 0.3,
                    impact: balance <= 5000 ? 'POSITIVE' : 'NEUTRAL',
                    explanation: `Saldo ${balance <= 5000 ? 'manejable' : 'considerable'}`,
                },
                {
                    name: 'Ritmo de Pago',
                    value: `${Math.round((minPayment / (balance || 1)) * 100)}%`,
                    weight: 0.15,
                    impact: minPayment >= balance * 0.08 ? 'POSITIVE' : minPayment >= balance * 0.04 ? 'NEUTRAL' : 'NEGATIVE',
                    explanation: minPayment >= balance * 0.08
                        ? 'Puede liquidarse más rápido'
                        : 'Pago mínimo limitado',
                },
                {
                    name: 'Tiempo Estimado',
                    value: `${monthsToPayoff} meses`,
                    weight: 0.15,
                    impact: monthsToPayoff <= 6 ? 'POSITIVE' : monthsToPayoff <= 12 ? 'NEUTRAL' : 'NEGATIVE',
                    explanation: monthsToPayoff <= 6
                        ? 'Puede liquidarse pronto'
                        : 'Requiere compromiso a largo plazo',
                }
            );
            break;
    }

    const summaryMap: Record<PayoffStrategy, string> = {
        'AVALANCHE': `Priorizado por APR de ${apr}%. ${apr >= 40 ? 'Urgente eliminar esta deuda costosa.' : 'Pagar para reducir intereses.'}`,
        'SNOWBALL': `Saldo de ${balance.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' })}. ${balance <= 2000 ? '¡Victoria rápida!' : 'Pagarlo liberará flujo.'}`,
        'HYBRID': `Balance óptimo: APR ${apr}%, saldo ${balance.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' })}, ritmo de pago ${Math.round((minPayment / (balance || 1)) * 100)}%.`,
    };

    return {
        factors,
        summary: summaryMap[strategy],
    };
}

// ============================================
// TIMELINE GENERATION
// ============================================

function generateTimeline(
    debts: DebtWithPriority[],
    monthlyBudget: number,
    maxIterations = 600, // VUL-010: Configurable iteration limit
    options?: EngineOptions
): PayoffStep[] {
    const timeline: PayoffStep[] = [];
    const workingDebts = debts.map(d => ({
        ...d,
        currentBalance: Number(d.balance),
    }));

    const today = new Date();
    let periodStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    let iterations = 0;

    while (workingDebts.some(d => d.currentBalance > 0) && iterations < maxIterations) {
        iterations++;
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(0); // Last day of month

        const step = calculatePeriodStep(workingDebts, monthlyBudget, periodStart, periodEnd, options);
        timeline.push(step);

        // Apply payments and interest
        for (const snapshot of step.debtSnapshots) {
            const debt = workingDebts.find(d => d.id === snapshot.debtId);
            if (debt) {
                debt.currentBalance = snapshot.endBalance;
            }
        }

        periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() + 1);
    }

    // VUL-010: Check if we reached iteration limit
    if (iterations >= maxIterations && workingDebts.some(d => d.currentBalance > 0)) {
        const remainingBalance = workingDebts.reduce((sum, d) => sum + d.currentBalance, 0);
        console.error('[ENGINE] Max iterations reached', {
            iterations,
            maxIterations,
            remainingBalance,
            activeDebts: workingDebts.filter(d => d.currentBalance > 0).length,
        });
        throw new Error(
            `Cálculo excedió límite de ${Math.floor(maxIterations / 12)} años. ` +
            `Saldo restante: ${remainingBalance.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' })}. ` +
            `Considera aumentar tu presupuesto mensual o consolidar deudas.`
        );
    }

    return timeline;
}

function diffInDays(a: Date, b: Date): number {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utcA - utcB) / MS_PER_DAY);
}

function daysInMonth(year: number, monthIndex0: number): number {
    return new Date(year, monthIndex0 + 1, 0).getDate();
}

function clampDayToMonth(day: number, year: number, monthIndex0: number): number {
    return Math.min(Math.max(1, Math.trunc(day)), daysInMonth(year, monthIndex0));
}

function resolvePaymentDay(
    debt: DebtWithPriority & { currentBalance: number },
    periodStart: Date,
    periodEnd: Date,
    options?: EngineOptions
): number {
    const timing = options?.paymentTiming ?? 'DUE_DAY';
    if (timing === 'FIRST_DAY') return 1;
    if (timing === 'LAST_DAY') return periodEnd.getDate();

    const candidate = Number(debt.payment_day || debt.due_date || periodEnd.getDate());
    return clampDayToMonth(candidate, periodStart.getFullYear(), periodStart.getMonth());
}

function calculateInterestForPeriod(params: {
    startBalance: number;
    apr: number;
    interestModel: string | null | undefined;
    periodStart: Date;
    periodEnd: Date;
    paymentAmount: number;
    paymentDay: number;
}): number {
    const { startBalance, apr, interestModel, periodStart, periodEnd, paymentAmount, paymentDay } = params;
    if (!apr || apr <= 0 || startBalance <= 0) return 0;

    const model = (interestModel || 'MONTHLY_SIMPLE').toUpperCase();
    if (model === 'MONTHLY_SIMPLE') {
        const monthlyRate = apr / 100 / 12;
        return startBalance * monthlyRate;
    }

    // Daily models (DAILY_SIMPLE / DAILY_AVG_BALANCE) approximated with:
    // - one payment applied on `paymentDay` (at start of day)
    // - no new charges
    const dailyRate = apr / 100 / 365;
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth();
    const day = clampDayToMonth(paymentDay, year, month);
    const payDate = new Date(year, month, day);

    const totalDays = diffInDays(periodEnd, periodStart) + 1;
    const daysBeforePayment = Math.max(0, Math.min(totalDays, diffInDays(payDate, periodStart)));
    const daysAfterPayment = Math.max(0, totalDays - daysBeforePayment);

    const balanceAfterPayment = Math.max(0, startBalance - paymentAmount);
    const interestBefore = startBalance * dailyRate * daysBeforePayment;
    const interestAfter = balanceAfterPayment * dailyRate * daysAfterPayment;

    return interestBefore + interestAfter;
}

function calculatePeriodStep(
    debts: (DebtWithPriority & { currentBalance: number })[],
    monthlyBudget: number,
    periodStart: Date,
    periodEnd: Date,
    options?: EngineOptions
): PayoffStep {
    const activeDebts = debts.filter(d => d.currentBalance > 0);

    if (activeDebts.length === 0) {
        return {
            periodStart,
            periodEnd,
            payments: [],
            debtSnapshots: [],
            focusDebtId: '',
        };
    }

    const payments: PaymentAllocation[] = [];
    const snapshots: DebtSnapshot[] = [];
    let remainingBudget = monthlyBudget;

    // First: pay minimums on all debts
    for (const debt of activeDebts) {
        const minPayment = Math.min(Number(debt.min_payment), debt.currentBalance);
        if (minPayment > 0 && remainingBudget >= minPayment) {
            payments.push({
                debtId: debt.id,
                creditor: debt.creditor,
                amount: minPayment,
                type: 'MINIMUM',
            });
            remainingBudget -= minPayment;
        }
    }

    // Second: cascade the surplus across debts in priority order.
    //
    // Two constraints here were the root cause of a critical bug (see
    // engine.regression.test.ts): the payoff cap must include the interest
    // that accrues THIS period — otherwise a "paid off" debt retains an
    // interest-sized residual, stays active, and holds the focus slot
    // forever — and once the focus debt is fully covered the remaining
    // surplus must flow to the NEXT debt instead of being discarded.
    const focusDebt = activeDebts[0]; // Already sorted by priority
    for (const debt of activeDebts) {
        if (remainingBudget <= PAYOFF_EPSILON) break;

        const existingPayment = payments.find(p => p.debtId === debt.id);
        const alreadyPaid = existingPayment?.amount || 0;
        const fees = Math.max(0, Number(debt.monthly_fees || 0));
        const startBalanceWithFees = debt.currentBalance + fees;
        const paymentDay = resolvePaymentDay(debt, periodStart, periodEnd, options);
        // Provisional interest for the payoff cap. Exact for MONTHLY_SIMPLE
        // (interest is independent of the payment); a slightly conservative
        // upper bound for daily models, where a larger payment lowers the
        // final interest and the snapshot below clamps the residue to zero.
        const interest = calculateInterestForPeriod({
            startBalance: startBalanceWithFees,
            apr: Number(debt.apr) || 0,
            interestModel: debt.interest_model,
            periodStart,
            periodEnd,
            paymentAmount: alreadyPaid,
            paymentDay,
        });
        const payoffAmount = startBalanceWithFees + interest;
        const extraPayment = Math.min(remainingBudget, payoffAmount - alreadyPaid);
        if (extraPayment <= 0) continue;

        if (existingPayment) {
            existingPayment.amount += extraPayment;
            existingPayment.type =
                existingPayment.amount >= payoffAmount - PAYOFF_EPSILON ? 'PAYOFF' : 'EXTRA';
        } else {
            payments.push({
                debtId: debt.id,
                creditor: debt.creditor,
                amount: extraPayment,
                type: extraPayment >= payoffAmount - PAYOFF_EPSILON ? 'PAYOFF' : 'EXTRA',
            });
        }
        remainingBudget -= extraPayment;
    }

    // Calculate snapshots with interest and optional recurring fees.
    for (const debt of activeDebts) {
        const payment = payments.find(p => p.debtId === debt.id)?.amount || 0;
        const fees = Math.max(0, Number(debt.monthly_fees || 0));
        const startBalanceWithFees = debt.currentBalance + fees;

        const paymentDay = resolvePaymentDay(debt, periodStart, periodEnd, options);
        const interest = calculateInterestForPeriod({
            startBalance: startBalanceWithFees,
            apr: Number(debt.apr) || 0,
            interestModel: debt.interest_model,
            periodStart,
            periodEnd,
            paymentAmount: payment,
            paymentDay,
        });

        // Sub-centavo residuals count as fully paid: a floating-point crumb
        // must never keep a debt "active" (see cascade comment above).
        const rawEndBalance = startBalanceWithFees + interest - payment;
        const endBalance = rawEndBalance < PAYOFF_EPSILON ? 0 : rawEndBalance;

        snapshots.push({
            debtId: debt.id,
            creditor: debt.creditor,
            startBalance: debt.currentBalance,
            payment,
            interest,
            endBalance,
        });
    }

    return {
        periodStart,
        periodEnd,
        payments,
        debtSnapshots: snapshots,
        focusDebtId: focusDebt?.id || '',
    };
}

// ============================================
// SUMMARY CALCULATION
// ============================================

function calculateSummary(debts: DebtWithPriority[], timeline: PayoffStep[]): PayoffSummary {
    const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalInterest = timeline.reduce((sum, step) =>
        sum + step.debtSnapshots.reduce((s, snap) => s + snap.interest, 0), 0
    );
    const totalPayments = timeline.reduce((sum, step) =>
        sum + step.payments.reduce((s, p) => s + p.amount, 0), 0
    );
    const monthsToPayoff = timeline.length;

    const lastDay = timeline.length > 0
        ? timeline[timeline.length - 1].periodEnd
        : new Date();

    const focusDebt = debts[0];
    const avgMonthlyPayment = monthsToPayoff > 0 ? totalPayments / monthsToPayoff : 0;

    return {
        totalDebt,
        totalInterest,
        totalPayments,
        monthsToPayoff,
        etaDebtFree: lastDay,
        avgMonthlyPayment,
        focusDebtId: focusDebt?.id || '',
        focusDebtCreditor: focusDebt?.creditor || '',
    };
}

// ============================================
// COMPARISON FUNCTION
// ============================================

export function comparePlans(debts: Debt[], monthlyBudget: number, currency: 'GTQ' | 'USD'): PlanComparison {
    return comparePlansPersonalized(debts, monthlyBudget, currency, {});
}

// ============================================
// PERSONALIZED RECOMMENDATION (GOAL-AWARE)
// ============================================

export interface ComparePlansOptions {
    goalType?: GoalType;
    motivationLevel?: number; // 1-5 (higher = less need for quick wins)
    riskTolerance?: number; // 1-5 (higher = more willing to take tight plans)
    engineConfig?: ResolvedEngineConfig;
}

function firstWinMonths(plan: PayoffPlan): number {
    for (let i = 0; i < plan.timeline.length; i++) {
        const step = plan.timeline[i];
        for (const snap of step.debtSnapshots) {
            if (snap.startBalance > 0 && snap.endBalance === 0) {
                return i + 1;
            }
        }
    }
    return plan.timeline.length;
}

function normalize(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return 1;
    if (max <= min) return 0;
    return (value - min) / (max - min);
}

function clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
}

function estimateRecommendationConfidence(debtsInput: Debt[]): number {
    if (debtsInput.length === 0) return 0.5;

    let penalty = 0;
    for (const d of debtsInput) {
        const model = (d.interest_model || '').toUpperCase();
        const hasPaymentDay = Number.isFinite(Number(d.payment_day)) || Number.isFinite(Number(d.due_date));

        if (!model) penalty += 0.05;
        if (d.type === 'CREDIT_CARD' && model === 'MONTHLY_SIMPLE') penalty += 0.10;
        if (!hasPaymentDay) penalty += 0.05;
    }

    // Range: keep some humility even with defaults.
    return clamp01(0.9 - penalty);
}

export function comparePlansPersonalized(
    debts: Debt[],
    monthlyBudget: number,
    currency: 'GTQ' | 'USD',
    options: ComparePlansOptions
): PlanComparison {
    const goalType: GoalType = options.goalType || 'BALANCED';
    const motivation = Math.max(1, Math.min(5, Math.trunc(options.motivationLevel || 3)));
    const riskTolerance = Math.max(1, Math.min(5, Math.trunc(options.riskTolerance || 3)));
    const engineOptions: EngineOptions = {
        engineConfig: options.engineConfig ?? DEFAULT_ENGINE_CONFIG,
    };

    const avalanchePlan = calculatePayoffPlan({ debts, monthlyBudget, currency, strategy: 'AVALANCHE' }, undefined, engineOptions);
    const snowballPlan = calculatePayoffPlan({ debts, monthlyBudget, currency, strategy: 'SNOWBALL' }, undefined, engineOptions);
    const hybridPlan = calculatePayoffPlan({ debts, monthlyBudget, currency, strategy: 'HYBRID' }, undefined, engineOptions);

    const all = [
        { strategy: 'AVALANCHE' as PayoffStrategy, plan: avalanchePlan },
        { strategy: 'SNOWBALL' as PayoffStrategy, plan: snowballPlan },
        { strategy: 'HYBRID' as PayoffStrategy, plan: hybridPlan },
    ];

    const metrics = all.map(({ strategy, plan }) => ({
        strategy,
        totalInterest: plan.summary.totalInterest,
        monthsToPayoff: plan.summary.monthsToPayoff,
        firstWin: firstWinMonths(plan),
    }));

    const minInterest = Math.min(...metrics.map(m => m.totalInterest));
    const maxInterest = Math.max(...metrics.map(m => m.totalInterest));
    const minMonths = Math.min(...metrics.map(m => m.monthsToPayoff));
    const maxMonths = Math.max(...metrics.map(m => m.monthsToPayoff));
    const minFirstWin = Math.min(...metrics.map(m => m.firstWin));
    const maxFirstWin = Math.max(...metrics.map(m => m.firstWin));

    function score(m: (typeof metrics)[number]): number {
        if (goalType === 'LEAST_INTEREST') {
            return normalize(m.totalInterest, minInterest, maxInterest);
        }
        if (goalType === 'FASTEST') {
            return normalize(m.monthsToPayoff, minMonths, maxMonths);
        }

        // BALANCED: weights adjust with motivation/risk tolerance.
        // Lower motivation => prioritize quick wins more.
        const wFirstWin = 0.20 + (5 - motivation) * 0.03;
        // Lower risk tolerance => prioritize shorter time-to-debt-free more.
        const wMonths = 0.30 + (5 - riskTolerance) * 0.03;
        const wInterest = 1 - wFirstWin - wMonths;

        const nInterest = normalize(m.totalInterest, minInterest, maxInterest);
        const nMonths = normalize(m.monthsToPayoff, minMonths, maxMonths);
        const nFirstWin = normalize(m.firstWin, minFirstWin, maxFirstWin);
        return wInterest * nInterest + wMonths * nMonths + wFirstWin * nFirstWin;
    }

    // Hard map from onboarding goal (Fase B): FASTEST→SNOWBALL, LEAST_INTEREST→AVALANCHE, BALANCED→HYBRID.
    const mappedStrategy = goalTypeToStrategy(goalType);
    const recommended = metrics.find((m) => m.strategy === mappedStrategy) ?? metrics[0];
    const ranked = [...metrics].sort((a, b) => score(a) - score(b));
    const runnerUp = ranked.find((m) => m.strategy !== recommended.strategy) ?? ranked[1] ?? ranked[0];

    const interestSaved = runnerUp.totalInterest - recommended.totalInterest;
    const monthsSaved = runnerUp.monthsToPayoff - recommended.monthsToPayoff;
    const firstWinDelta = runnerUp.firstWin - recommended.firstWin;

    const drivers: string[] = [goalStrategyReason(goalType)];
    if (interestSaved > 0) drivers.push(`Ahorro estimado de interés vs alternativa: ${interestSaved.toLocaleString('es-GT', { style: 'currency', currency })}.`);
    if (monthsSaved > 0) drivers.push(`Reduce el tiempo total vs alternativa: ${monthsSaved} mes(es).`);
    if (firstWinDelta > 0) drivers.push(`Logra una primera deuda liquidada antes: ${firstWinDelta} mes(es).`);

    const confidence = estimateRecommendationConfidence(debts);

    // Uncertainty range for the recommended strategy due to payment timing within the month.
    let range: PlanComparison['recommendationRange'] = undefined;
    try {
        const optimistic = calculatePayoffPlan(
            { debts, monthlyBudget, currency, strategy: recommended.strategy },
            undefined,
            { paymentTiming: 'FIRST_DAY', engineConfig: engineOptions.engineConfig },
        );
        const pessimistic = calculatePayoffPlan(
            { debts, monthlyBudget, currency, strategy: recommended.strategy },
            undefined,
            { paymentTiming: 'LAST_DAY', engineConfig: engineOptions.engineConfig },
        );
        range = {
            monthsToPayoff: {
                min: Math.min(optimistic.summary.monthsToPayoff, pessimistic.summary.monthsToPayoff),
                max: Math.max(optimistic.summary.monthsToPayoff, pessimistic.summary.monthsToPayoff),
            },
            totalInterest: {
                min: Math.min(optimistic.summary.totalInterest, pessimistic.summary.totalInterest),
                max: Math.max(optimistic.summary.totalInterest, pessimistic.summary.totalInterest),
            },
        };
    } catch {
        // Best-effort; keep range undefined if something unexpected happens.
    }

    return {
        avalanche: avalanchePlan.summary,
        snowball: snowballPlan.summary,
        hybrid: hybridPlan.summary,
        recommendation: recommended.strategy,
        recommendationReason: drivers.slice(0, 2).join(' '),
        recommendationMeta: {
            goalType,
            confidence,
            drivers: drivers.slice(0, 3),
        },
        recommendationRange: range,
    };
}
