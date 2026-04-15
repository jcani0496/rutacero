// Engine Types for Debt Payoff Planning

import type { Debt, Currency } from '@/types';

// ============================================
// STRATEGY TYPES
// ============================================

export type PayoffStrategy = 'AVALANCHE' | 'SNOWBALL' | 'HYBRID';

// ============================================
// ENGINE INPUT/OUTPUT
// ============================================

export interface PayoffInput {
    debts: Debt[];
    monthlyBudget: number;
    currency: Currency;
    strategy: PayoffStrategy;
}

export interface PayoffPlan {
    strategy: PayoffStrategy;
    engineVersion: string;
    generatedAt: Date;
    debts: DebtWithPriority[];
    timeline: PayoffStep[];
    summary: PayoffSummary;
}

export interface DebtWithPriority extends Debt {
    priorityOrder: number;
    priorityScore: number;
    rationale: RationaleBreakdown;
}

export interface PayoffStep {
    periodStart: Date;
    periodEnd: Date;
    payments: PaymentAllocation[];
    debtSnapshots: DebtSnapshot[];
    focusDebtId: string;
}

export interface PaymentAllocation {
    debtId: string;
    creditor: string;
    amount: number;
    type: 'MINIMUM' | 'EXTRA' | 'PAYOFF';
}

export interface DebtSnapshot {
    debtId: string;
    creditor: string;
    startBalance: number;
    payment: number;
    interest: number;
    endBalance: number;
}

// ============================================
// SUMMARY
// ============================================

export interface PayoffSummary {
    totalDebt: number;
    totalInterest: number;
    totalPayments: number;
    monthsToPayoff: number;
    etaDebtFree: Date;
    avgMonthlyPayment: number;
    focusDebtId: string;
    focusDebtCreditor: string;
}

// ============================================
// RATIONALE / EXPLAINABILITY
// ============================================

export interface RationaleBreakdown {
    factors: RationaleFactor[];
    summary: string;
}

export interface RationaleFactor {
    name: string;
    value: string | number;
    weight: number;
    impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    explanation: string;
}

// ============================================
// COMPARISON
// ============================================

export interface PlanComparison {
    avalanche: PayoffSummary;
    snowball: PayoffSummary;
    hybrid: PayoffSummary;
    recommendation: PayoffStrategy;
    recommendationReason: string;
    recommendationMeta?: {
        goalType: 'FASTEST' | 'LEAST_INTEREST' | 'BALANCED';
        confidence: number; // 0-1
        drivers: string[];
    };
    recommendationRange?: {
        monthsToPayoff: { min: number; max: number };
        totalInterest: { min: number; max: number };
    };
}
