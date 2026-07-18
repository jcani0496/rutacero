/**
 * Pure math helpers for insights. All functions are deterministic and
 * side-effect free so they are trivial to unit-test.
 *
 * NOTE: These are simplified approximations suitable for "neutral
 * observations" copy. They intentionally do not model fees, late charges,
 * or rate changes. The UI always pairs the output with the canonical
 * financial disclaimer.
 */

import type { DebtSnapshot } from './types';
import {
    guatemalaCalendarDay,
    guatemalaCalendarDayPlus,
    storedDateCalendarDay,
} from '@/lib/dates/guatemala';

/**
 * Approximates the next month's interest charge on a debt:
 *   monthlyInterest = balance * (apr/100) / 12
 *
 * Returns 0 when apr or balance is missing / non-positive.
 */
export function monthlyInterestFor(debt: Pick<DebtSnapshot, 'balance' | 'apr'>): number {
    const balance = Number(debt.balance);
    const apr = Number(debt.apr ?? 0);
    if (!Number.isFinite(balance) || !Number.isFinite(apr)) return 0;
    if (balance <= 0 || apr <= 0) return 0;
    return (balance * (apr / 100)) / 12;
}

/**
 * Sum of approximated monthly interest across all provided debts.
 */
export function totalMonthlyInterest(debts: DebtSnapshot[]): number {
    return debts.reduce((acc, d) => acc + monthlyInterestFor(d), 0);
}

/**
 * Sum of minimum payments across all provided debts.
 */
export function totalMinPayments(debts: DebtSnapshot[]): number {
    return debts.reduce((acc, d) => acc + (Number(d.minPayment) || 0), 0);
}

/**
 * Sum of balances across all provided debts.
 */
export function totalBalance(debts: DebtSnapshot[]): number {
    return debts.reduce((acc, d) => acc + (Number(d.balance) || 0), 0);
}

/**
 * Estimates the number of months to fully pay off a debt at a given monthly
 * payment, using standard amortization:
 *
 *   n = -ln(1 - r * P / m) / ln(1 + r)
 *
 * Where r = apr/100/12, P = balance, m = monthly payment.
 *
 * Special cases:
 *  - payment <= 0 or balance <= 0 -> null (cannot estimate)
 *  - apr <= 0 -> simple division (no interest)
 *  - payment <= interest portion -> null (debt never amortizes)
 *  - returns ceil(n) to give the user-facing "months until paid off"
 *  - capped at 600 months (50 years) to avoid runaway projections
 */
export function payoffMonths(
    balance: number,
    apr: number | null,
    monthlyPayment: number,
): number | null {
    if (!Number.isFinite(balance) || !Number.isFinite(monthlyPayment)) return null;
    if (balance <= 0 || monthlyPayment <= 0) return null;

    const safeApr = Number(apr ?? 0);
    if (!Number.isFinite(safeApr) || safeApr <= 0) {
        return Math.min(600, Math.ceil(balance / monthlyPayment));
    }

    const r = safeApr / 100 / 12;
    const interestPortion = balance * r;
    if (monthlyPayment <= interestPortion) return null;

    const n = -Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(600, Math.ceil(n));
}

/**
 * Total interest paid over the life of the loan at a given monthly payment.
 * Returns null when the loan does not amortize (monthlyPayment <= interest).
 */
export function totalInterestPaid(
    balance: number,
    apr: number | null,
    monthlyPayment: number,
): number | null {
    const months = payoffMonths(balance, apr, monthlyPayment);
    if (months === null) return null;
    const totalPaid = months * monthlyPayment;
    const interest = totalPaid - balance;
    return Math.max(0, interest);
}

export interface WhatIfDelta {
    /** Original payoff months at base payment. */
    baseMonths: number;
    /** New payoff months at base + extra payment. */
    newMonths: number;
    /** Months saved (baseMonths - newMonths). */
    monthsSaved: number;
    /** Interest savings (totalInterest base - totalInterest new). */
    interestSaved: number;
}

/**
 * Compares a base monthly payment to a base + extra payment, and returns
 * the months and interest saved. Returns null when either scenario does not
 * amortize.
 */
export function whatIfExtraPayment(
    balance: number,
    apr: number | null,
    basePayment: number,
    extra: number,
): WhatIfDelta | null {
    if (extra <= 0 || basePayment <= 0 || balance <= 0) return null;

    const baseMonths = payoffMonths(balance, apr, basePayment);
    const newMonths = payoffMonths(balance, apr, basePayment + extra);
    if (baseMonths === null || newMonths === null) return null;

    const baseInterest = totalInterestPaid(balance, apr, basePayment) ?? 0;
    const newInterest = totalInterestPaid(balance, apr, basePayment + extra) ?? 0;

    const monthsSaved = Math.max(0, baseMonths - newMonths);
    const interestSaved = Math.max(0, baseInterest - newInterest);

    return { baseMonths, newMonths, monthsSaved, interestSaved };
}

/**
 * Returns the debt with the highest monthly interest cost (most expensive in
 * absolute interest terms), or null when there are no qualifying debts.
 */
export function mostExpensiveDebt(debts: DebtSnapshot[]): DebtSnapshot | null {
    let best: DebtSnapshot | null = null;
    let bestInterest = 0;
    for (const d of debts) {
        const interest = monthlyInterestFor(d);
        if (interest > bestInterest) {
            best = d;
            bestInterest = interest;
        }
    }
    return best;
}

/**
 * Returns the debt with the smallest positive balance, or null when empty.
 */
export function smallestDebt(debts: DebtSnapshot[]): DebtSnapshot | null {
    let best: DebtSnapshot | null = null;
    for (const d of debts) {
        if (d.balance <= 0) continue;
        if (!best || d.balance < best.balance) best = d;
    }
    return best;
}

/**
 * Returns debts due on or after `fromIso` and on or before `fromIso + windowDays`,
 * sorted ascending by next_payment_date. Pure: caller supplies the "now".
 *
 * Comparisons happen at Guatemala calendar-day granularity, both bounds
 * inclusive. Millisecond math silently dropped a payment due TODAY (the
 * bare `YYYY-MM-DD` parsed to UTC midnight, always earlier than the
 * computedAt timestamp) and shifted days for Guatemala evenings, where
 * the UTC calendar has already rolled over (audit 2026-07).
 */
export function debtsDueWithin(
    debts: DebtSnapshot[],
    fromIso: string,
    windowDays: number,
): DebtSnapshot[] {
    const from = new Date(fromIso);
    if (Number.isNaN(from.getTime())) return [];
    const fromDay = guatemalaCalendarDay(from);
    const toDay = guatemalaCalendarDayPlus(from, windowDays);

    return debts
        .filter((d) => {
            const day = storedDateCalendarDay(d.nextPaymentDate);
            return day !== null && day >= fromDay && day <= toDay;
        })
        .sort((a, b) => {
            const dayA = storedDateCalendarDay(a.nextPaymentDate) ?? '';
            const dayB = storedDateCalendarDay(b.nextPaymentDate) ?? '';
            return dayA.localeCompare(dayB);
        });
}

/**
 * Returns the soonest upcoming payment (due on or after `fromIso`'s
 * Guatemala calendar day), or null when none. Same day-granularity
 * rationale as debtsDueWithin.
 */
export function nextUpcomingPayment(
    debts: DebtSnapshot[],
    fromIso: string,
): DebtSnapshot | null {
    const from = new Date(fromIso);
    if (Number.isNaN(from.getTime())) return null;
    const fromDay = guatemalaCalendarDay(from);
    let best: DebtSnapshot | null = null;
    let bestDay = '';
    for (const d of debts) {
        const day = storedDateCalendarDay(d.nextPaymentDate);
        if (day === null || day < fromDay) continue;
        if (best === null || day < bestDay) {
            best = d;
            bestDay = day;
        }
    }
    return best;
}
