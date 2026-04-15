// Forecasting Engine - Cash Flow Projections

import type { Debt, Currency } from '@/types';

// ============================================
// TYPES
// ============================================

export interface ForecastPeriod {
    periodStart: Date;
    periodEnd: Date;
    month: number;
    year: number;
    label: string;
}

export interface IncomeProjection {
    amount: number;
    source: string;
    type: 'FIXED' | 'VARIABLE';
}

export interface ExpenseProjection {
    amount: number;
    name: string;
    category: string;
    type: 'NEED' | 'WANT';
}

export interface DebtPaymentProjection {
    debtId: string;
    creditor: string;
    amount: number;
    dueDate: number | null;
    isFocus: boolean;
}

export interface CashFlowProjection {
    period: ForecastPeriod;
    totalIncome: number;
    totalExpenses: number;
    totalDebtPayments: number;
    netCashFlow: number;
    availableForExtra: number;
    incomes: IncomeProjection[];
    expenses: ExpenseProjection[];
    debtPayments: DebtPaymentProjection[];
    cumulativeDebtPaid: number;
    remainingDebt: number;
}

export interface CashFlowForecast {
    periods: CashFlowProjection[];
    summary: ForecastSummary;
    gaps: CashFlowGap[];
    currency: Currency;
}

export interface ForecastSummary {
    totalIncome12m: number;
    totalExpenses12m: number;
    totalDebtPayments12m: number;
    avgMonthlyNet: number;
    worstMonth: ForecastPeriod | null;
    bestMonth: ForecastPeriod | null;
    projectedDebtFreeDate: Date | null;
}

export interface CashFlowGap {
    period: ForecastPeriod;
    shortfall: number;
    severity: 'WARNING' | 'CRITICAL';
    suggestion: string;
}

// ============================================
// INPUT TYPES
// ============================================

export interface ForecastInput {
    debts: Debt[];
    incomes: { amount: number; source: string; type: 'FIXED' | 'VARIABLE' }[];
    expenses: { amount: number; name: string; category: string; expense_type: 'NEED' | 'WANT' }[];
    currency: Currency;
    extraPaymentBudget?: number;
    timezone?: string; // INFO-011: User's timezone for date formatting
}

// ============================================
// MAIN FORECAST FUNCTION
// ============================================

export function generateCashFlowForecast(
    input: ForecastInput,
    horizonMonths: number = 12
): CashFlowForecast {
    // VUL-010: Validate horizon to prevent excessive iterations
    const MAX_HORIZON_MONTHS = 120; // 10 years max
    if (horizonMonths < 1) {
        throw new Error('Horizon months must be at least 1');
    }
    if (horizonMonths > MAX_HORIZON_MONTHS) {
        throw new Error(
            `Horizon excede límite de ${MAX_HORIZON_MONTHS} meses (${Math.floor(MAX_HORIZON_MONTHS / 12)} años). ` +
            `Para proyecciones más largas, usa un período más amplio.`
        );
    }

    const { debts, incomes, expenses, currency, timezone = 'America/Guatemala' } = input;
    const extraPaymentBudget = Math.max(0, Number(input.extraPaymentBudget || 0));

    const periods: CashFlowProjection[] = [];
    let cumulativeDebtPaid = 0;
    const workingDebts = debts
        .filter((d) => d.status === 'ACTIVE')
        .map((d) => ({
            ...d,
            balance: Number(d.balance),
            min_payment: Number(d.min_payment),
            apr: Number(d.apr) || 0,
        }));
    let remainingDebt = workingDebts.reduce((sum, d) => sum + Number(d.balance), 0);

    const today = new Date();

    for (let i = 0; i < horizonMonths; i++) {
        const periodStart = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const periodEnd = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);

        const period: ForecastPeriod = {
            periodStart,
            periodEnd,
            month: periodStart.getMonth() + 1, // tests expect 1-12
            year: periodStart.getFullYear(),
            // INFO-011: Use user's timezone for date formatting
            label: periodStart.toLocaleDateString('es-GT', {
                month: 'short',
                year: 'numeric',
                timeZone: timezone
            }),
        };

        // Project incomes
        const incomeProjections: IncomeProjection[] = incomes.map(inc => ({
            amount: Number(inc.amount),
            source: inc.source,
            type: inc.type,
        }));
        const totalIncome = incomeProjections.reduce((sum, i) => sum + i.amount, 0);

        // Project expenses
        const expenseProjections: ExpenseProjection[] = expenses.map(exp => ({
            amount: Number(exp.amount),
            name: exp.name,
            category: exp.category,
            type: exp.expense_type,
        }));
        const totalExpenses = expenseProjections.reduce((sum, e) => sum + e.amount, 0);

        // Project debt payments (minimum payments)
        const activeDebts = workingDebts.filter((d) => d.balance > 0);
        const focusDebt = [...activeDebts].sort((a, b) => b.apr - a.apr)[0];

        const debtPayments: DebtPaymentProjection[] = activeDebts.map((d) => ({
            debtId: d.id,
            creditor: d.creditor,
            amount: Math.min(d.min_payment, d.balance),
            dueDate: d.due_date,
            isFocus: d.id === focusDebt?.id,
        }));

        const totalMinDebtPayments = debtPayments.reduce((sum, p) => sum + p.amount, 0);

        // Apply extra payment budget to focus debt (capped by remaining debt).
        const possibleExtra = Math.min(extraPaymentBudget, remainingDebt - totalMinDebtPayments);
        if (possibleExtra > 0 && focusDebt) {
            const focusPayment = debtPayments.find((p) => p.debtId === focusDebt.id);
            if (focusPayment) {
                const remainingFocus = Math.max(0, focusDebt.balance - focusPayment.amount);
                const appliedExtra = Math.min(possibleExtra, remainingFocus);
                focusPayment.amount += appliedExtra;
            }
        }

        const totalDebtPayments = debtPayments.reduce((sum, p) => sum + p.amount, 0);

        const netCashFlow = totalIncome - totalExpenses - totalDebtPayments;
        const availableForExtra = Math.max(0, netCashFlow);

        // Reduce balances (simple principal-only projection).
        for (const p of debtPayments) {
            const d = workingDebts.find((wd) => wd.id === p.debtId);
            if (!d) continue;
            d.balance = Math.max(0, d.balance - p.amount);
        }

        cumulativeDebtPaid += totalDebtPayments;
        remainingDebt = Math.max(0, remainingDebt - totalDebtPayments);

        periods.push({
            period,
            totalIncome,
            totalExpenses,
            totalDebtPayments,
            netCashFlow,
            availableForExtra,
            incomes: incomeProjections,
            expenses: expenseProjections,
            debtPayments,
            cumulativeDebtPaid,
            remainingDebt,
        });
    }

    // Calculate summary
    const summary = calculateForecastSummary(periods, remainingDebt);

    // Detect cash flow gaps
    const gaps = detectCashFlowGaps(periods);

    return {
        periods,
        summary,
        gaps,
        currency,
    };
}

// ============================================
// SUMMARY CALCULATION
// ============================================

function calculateForecastSummary(
    periods: CashFlowProjection[],
    remainingDebt: number
): ForecastSummary {
    const totalIncome12m = periods.reduce((sum, p) => sum + p.totalIncome, 0);
    const totalExpenses12m = periods.reduce((sum, p) => sum + p.totalExpenses, 0);
    const totalDebtPayments12m = periods.reduce((sum, p) => sum + p.totalDebtPayments, 0);
    const avgMonthlyNet = periods.reduce((sum, p) => sum + p.netCashFlow, 0) / periods.length;

    // Find worst and best months
    let worstMonth: ForecastPeriod | null = null;
    let bestMonth: ForecastPeriod | null = null;
    let worstNet = Infinity;
    let bestNet = -Infinity;

    for (const p of periods) {
        if (p.netCashFlow < worstNet) {
            worstNet = p.netCashFlow;
            worstMonth = p.period;
        }
        if (p.netCashFlow > bestNet) {
            bestNet = p.netCashFlow;
            bestMonth = p.period;
        }
    }

    // Estimate debt-free date
    let projectedDebtFreeDate: Date | null = null;
    if (avgMonthlyNet > 0 && remainingDebt > 0) {
        const monthsToPayoff = Math.ceil(remainingDebt / avgMonthlyNet);
        const lastPeriod = periods[periods.length - 1];
        projectedDebtFreeDate = new Date(
            lastPeriod.period.periodStart.getFullYear(),
            lastPeriod.period.periodStart.getMonth() + monthsToPayoff,
            1
        );
    } else if (remainingDebt === 0) {
        projectedDebtFreeDate = new Date();
    }

    return {
        totalIncome12m,
        totalExpenses12m,
        totalDebtPayments12m,
        avgMonthlyNet,
        worstMonth,
        bestMonth,
        projectedDebtFreeDate,
    };
}

// ============================================
// GAP DETECTION
// ============================================

function detectCashFlowGaps(periods: CashFlowProjection[]): CashFlowGap[] {
    const gaps: CashFlowGap[] = [];

    for (const p of periods) {
        if (p.netCashFlow < 0) {
            const severity: 'WARNING' | 'CRITICAL' = p.netCashFlow < -500 ? 'CRITICAL' : 'WARNING';

            let suggestion = '';
            if (severity === 'CRITICAL') {
                suggestion = 'Considera reducir gastos variables o buscar ingresos adicionales para este mes.';
            } else {
                suggestion = 'Revisa gastos no esenciales para cubrir el déficit.';
            }

            gaps.push({
                period: p.period,
                shortfall: Math.abs(p.netCashFlow),
                severity,
                suggestion,
            });
        }
    }

    return gaps;
}

// ============================================
// PAYMENT CALENDAR GENERATION
// ============================================

export interface CalendarEvent {
    id: string;
    date: Date;
    title: string;
    amount: number;
    type: 'DEBT_PAYMENT' | 'INCOME' | 'EXPENSE';
    debtId?: string;
    color: string;
}

export function generatePaymentCalendar(
    debts: Debt[],
    month: number,
    year: number
): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    for (const debt of debts) {
        if (debt.status !== 'ACTIVE') continue;
        if (debt.due_date === null) continue; // Skip debts without due date

        const dueDay = debt.due_date;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const actualDay = Math.min(dueDay, daysInMonth);

        events.push({
            id: `payment-${debt.id}-${month}-${year}`,
            date: new Date(year, month, actualDay),
            title: `Pago: ${debt.creditor}`,
            amount: Number(debt.min_payment),
            type: 'DEBT_PAYMENT',
            debtId: debt.id,
            color: debt.type === 'CREDIT_CARD' ? '#3b82f6' : '#10b981',
        });
    }

    // Sort by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    return events;
}
