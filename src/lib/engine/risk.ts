// Risk Assessment Engine - Debt Health Scoring

import type { Debt } from '@/types';

// ============================================
// TYPES
// ============================================

export type RiskLevel = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

export interface RiskScore {
    score: number; // 0-100, higher = better
    level: RiskLevel;
    factors: RiskFactor[];
    recommendations: RiskRecommendation[];
}

export interface RiskFactor {
    name: string;
    weight: number;
    score: number; // 0-100
    value: string;
    impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    description: string;
}

export interface RiskRecommendation {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    action: string;
}

export interface DebtHealthInput {
    debts: Debt[];
    monthlyIncome: number;
    monthlyExpenses: number;
    paymentHistory?: { debtId: string; onTime: boolean; date: string }[];
    emergencyFund?: number;
}

// ============================================
// MAIN RISK ASSESSMENT
// ============================================

export function calculateRiskScore(input: DebtHealthInput): RiskScore {
    const factors: RiskFactor[] = [];

    // Factor 1: Debt-to-Income Ratio (30%)
    const dtiScore = calculateDTIScore(input);
    factors.push(dtiScore);

    // Factor 2: Payment Burden (25%)
    const burdenScore = calculatePaymentBurdenScore(input);
    factors.push(burdenScore);

    // Factor 3: High Interest Debt (20%)
    const interestScore = calculateHighInterestScore(input.debts);
    factors.push(interestScore);

    // Factor 4: Emergency Buffer (15%)
    const bufferScore = calculateEmergencyBufferScore(input);
    factors.push(bufferScore);

    // Factor 5: Payment Consistency (10%)
    const consistencyScore = calculateConsistencyScore(input);
    factors.push(consistencyScore);

    // Calculate weighted average
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = totalWeight > 0
        ? factors.reduce((sum, f) => sum + (f.score * f.weight), 0) / totalWeight
        : 0;
    const finalScore = Math.round(weightedScore);

    // Determine risk level
    const level = determineRiskLevel(finalScore);

    // Generate recommendations
    const recommendations = generateRecommendations(factors);

    return {
        score: finalScore,
        level,
        factors,
        recommendations,
    };
}

// ============================================
// FACTOR CALCULATIONS
// ============================================

function calculateDTIScore(input: DebtHealthInput): RiskFactor {
    const totalDebt = input.debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const annualIncome = input.monthlyIncome * 12;
    const dtiRatio = annualIncome > 0 ? (totalDebt / annualIncome) * 100 : 100;

    // DTI < 20% = excellent, 20-35% = good, 35-50% = concerning, > 50% = critical
    let score = 100;
    if (dtiRatio <= 20) score = 100;
    else if (dtiRatio <= 35) score = 80 - ((dtiRatio - 20) * 2);
    else if (dtiRatio <= 50) score = 50 - ((dtiRatio - 35) * 2);
    else score = Math.max(0, 20 - ((dtiRatio - 50) * 0.5));

    const impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
        dtiRatio <= 20 ? 'POSITIVE' : dtiRatio <= 35 ? 'NEUTRAL' : 'NEGATIVE';

    return {
        name: 'Ratio Deuda/Ingreso',
        weight: 30,
        score: Math.round(score),
        value: `${dtiRatio.toFixed(1)}%`,
        impact,
        description: dtiRatio <= 20
            ? 'Excelente ratio de deuda a ingreso'
            : dtiRatio <= 35
                ? 'Ratio manejable pero vigila el crecimiento'
                : 'Ratio elevado, considera reducir deuda',
    };
}

function calculatePaymentBurdenScore(input: DebtHealthInput): RiskFactor {
    const totalMinPayments = input.debts.reduce((sum, d) => sum + Number(d.min_payment), 0);
    const availableIncome = input.monthlyIncome - input.monthlyExpenses;
    const burdenRatio = availableIncome > 0 ? (totalMinPayments / availableIncome) * 100 : 100;

    // Payments < 15% of available = good, 15-30% = moderate, > 30% = high burden
    let score = 100;
    if (burdenRatio <= 15) score = 100;
    else if (burdenRatio <= 30) score = 80 - ((burdenRatio - 15) * 2);
    else if (burdenRatio <= 50) score = 50 - ((burdenRatio - 30) * 1.5);
    else if (burdenRatio <= 80) score = 20 - ((burdenRatio - 50) * 0.5);
    else score = Math.max(0, 5 - ((burdenRatio - 80) * 0.25));

    const impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
        burdenRatio <= 30 ? 'POSITIVE' : burdenRatio <= 50 ? 'NEUTRAL' : 'NEGATIVE';

    return {
        name: 'Carga de Pagos',
        weight: 25,
        score: Math.round(score),
        value: `${burdenRatio.toFixed(1)}%`,
        impact,
        description: burdenRatio <= 30
            ? 'Pagos mínimos cómodamente cubiertos'
            : burdenRatio <= 50
                ? 'Carga moderada de pagos'
                : 'Alta carga de pagos mensuales',
    };
}

function calculateHighInterestScore(debts: Debt[]): RiskFactor {
    const highInterestDebts = debts.filter(d => Number(d.apr) >= 30);
    const totalHighInterest = highInterestDebts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const highInterestRatio = totalDebt > 0 ? (totalHighInterest / totalDebt) * 100 : 0;

    // < 20% high interest = good, 20-40% = moderate, > 40% = bad
    let score = 100;
    if (highInterestRatio <= 20) score = 100;
    else if (highInterestRatio <= 40) score = 70 - ((highInterestRatio - 20) * 1.5);
    else score = Math.max(0, 40 - ((highInterestRatio - 40) * 0.7));

    const impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
        highInterestRatio <= 20 ? 'POSITIVE' : highInterestRatio <= 40 ? 'NEUTRAL' : 'NEGATIVE';

    return {
        name: 'Deuda con Alto Interés',
        weight: 20,
        score: Math.round(score),
        value: `${highInterestRatio.toFixed(0)}%`,
        impact,
        description: highInterestRatio <= 20
            ? 'Poca exposición a tasas altas'
            : highInterestRatio <= 40
                ? 'Exposición moderada a tasas altas'
                : 'Alta exposición a tasas elevadas',
    };
}

function calculateEmergencyBufferScore(input: DebtHealthInput): RiskFactor {
    const emergencyFund = input.emergencyFund || 0;
    const monthlyExpenses = input.monthlyExpenses;
    const monthsCovered = monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : 0;

    // 6+ months = excellent, 3-6 = good, 1-3 = low, < 1 = critical
    let score = 100;
    if (monthsCovered >= 6) score = 100;
    else if (monthsCovered >= 3) score = 70 + ((monthsCovered - 3) * 10);
    else if (monthsCovered >= 1) score = 30 + ((monthsCovered - 1) * 20);
    else score = Math.max(0, monthsCovered * 30);

    const impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
        monthsCovered >= 3 ? 'POSITIVE' : monthsCovered >= 1 ? 'NEUTRAL' : 'NEGATIVE';

    return {
        name: 'Fondo de Emergencia',
        weight: 15,
        score: Math.round(score),
        value: `${monthsCovered.toFixed(1)} meses`,
        impact,
        description: monthsCovered >= 3
            ? 'Buen colchón de emergencia'
            : monthsCovered >= 1
                ? 'Fondo limitado, considera aumentarlo'
                : 'Sin fondo de emergencia',
    };
}

function calculateConsistencyScore(input: DebtHealthInput): RiskFactor {
    const history = input.paymentHistory || [];

    if (history.length === 0) {
        return {
            name: 'Consistencia de Pagos',
            weight: 10,
            score: 70, // Neutral if no history
            value: 'Sin historial',
            impact: 'NEUTRAL',
            description: 'Aún no hay historial de pagos registrado',
        };
    }

    const onTimeCount = history.filter(h => h.onTime).length;
    const onTimeRatio = (onTimeCount / history.length) * 100;

    const score = onTimeRatio;
    const impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
        onTimeRatio >= 90 ? 'POSITIVE' : onTimeRatio >= 70 ? 'NEUTRAL' : 'NEGATIVE';

    return {
        name: 'Consistencia de Pagos',
        weight: 10,
        score: Math.round(score),
        value: `${onTimeRatio.toFixed(0)}% a tiempo`,
        impact,
        description: onTimeRatio >= 90
            ? 'Excelente historial de pagos'
            : onTimeRatio >= 70
                ? 'Buen historial pero puede mejorar'
                : 'Historial irregular de pagos',
    };
}

// ============================================
// RISK LEVEL DETERMINATION
// ============================================

function determineRiskLevel(score: number): RiskLevel {
    // Slightly stricter threshold so "at-risk" scenarios don't get misclassified as healthy.
    if (score >= 75) return 'HEALTHY';
    if (score >= 40) return 'AT_RISK';
    return 'CRITICAL';
}

// ============================================
// RECOMMENDATIONS
// ============================================

function generateRecommendations(
    factors: RiskFactor[]
): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];

    // Check each factor for issues
    for (const factor of factors) {
        if (factor.impact === 'NEGATIVE') {
            switch (factor.name) {
                case 'Ratio Deuda/Ingreso':
                    recommendations.push({
                        priority: 'HIGH',
                        title: 'Reducir Ratio Deuda-Ingreso',
                        description: 'Tu deuda total es alta en relación a tus ingresos.',
                        action: 'Enfócate en pagar la deuda más pequeña primero para liberar flujo.',
                    });
                    break;

                case 'Carga de Pagos':
                    recommendations.push({
                        priority: 'HIGH',
                        title: 'Aliviar Carga de Pagos',
                        description: 'Los pagos mínimos consumen mucho de tu ingreso disponible.',
                        action: 'Considera consolidar deudas o negociar tasas más bajas.',
                    });
                    break;

                case 'Deuda con Alto Interés':
                    recommendations.push({
                        priority: 'MEDIUM',
                        title: 'Atacar Deudas Costosas',
                        description: 'Tienes mucha deuda con tasas de interés altas.',
                        action: 'Prioriza pagos extras a la deuda con mayor APR.',
                    });
                    break;

                case 'Fondo de Emergencia':
                    recommendations.push({
                        priority: 'MEDIUM',
                        title: 'Construir Fondo de Emergencia',
                        description: 'Tu colchón financiero es insuficiente.',
                        action: 'Ahorra al menos 1-3 meses de gastos antes de pagar deuda extra.',
                    });
                    break;

                case 'Consistencia de Pagos':
                    recommendations.push({
                        priority: 'HIGH',
                        title: 'Mejorar Puntualidad',
                        description: 'Los pagos tardíos afectan tu salud financiera.',
                        action: 'Configura pagos automáticos o recordatorios.',
                    });
                    break;
            }
        }
    }

    // Add general recommendation if score is low
    const avgScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;
    if (avgScore < 50 && recommendations.length === 0) {
        recommendations.push({
            priority: 'HIGH',
            title: 'Revisión Financiera Completa',
            description: 'Tu situación financiera requiere atención.',
            action: 'Considera consultar con un asesor financiero.',
        });
    }

    // Sort by priority
    const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations.slice(0, 3); // Max 3 recommendations
}

// ============================================
// QUICK HEALTH CHECK
// ============================================

export function assessDebtHealth(debts: Debt[], monthlyIncome: number): RiskLevel {
    if (debts.length === 0) return 'HEALTHY';

    const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalMinPayments = debts.reduce((sum, d) => sum + Number(d.min_payment), 0);
    const avgApr = debts.reduce((sum, d) => sum + Number(d.apr), 0) / debts.length;

    const dti = (totalDebt / (monthlyIncome * 12)) * 100;
    const paymentBurden = (totalMinPayments / monthlyIncome) * 100;

    if (dti > 50 || paymentBurden > 50 || avgApr > 40) {
        return 'CRITICAL';
    }

    if (dti > 35 || paymentBurden > 30 || avgApr > 25) {
        return 'AT_RISK';
    }

    return 'HEALTHY';
}
