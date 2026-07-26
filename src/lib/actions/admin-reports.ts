'use server';

import {
    and,
    asc,
    desc,
    eq,
    getTableColumns as getDrizzleTableColumns,
    gte,
    lte,
    type SQL,
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getDb, schema } from '@/db/client';
import type { Json } from '@/types/supabase';
import { buildGtmScorecardRows, GTM_SCORECARD_HEADERS } from '@/lib/funnel/scorecard';
import { drizzleListAlertsForReport } from '@/lib/support/drizzle';
import { getProVariant, monthlyEquivalent } from '@/lib/billing/plans';
import { requirePermission } from './admin-auth';

/**
 * Normalize a subscription row into monthly revenue (MRR contribution).
 * Prefers charged `price_amount_q` + interval; falls back to catalog prices
 * (never the old invented PRO=99 / BUSINESS=299 literals).
 */
function monthlyRevenueFromSubscription(sub: {
    plan_code: string | null;
    price_amount_q?: number | string | null;
    billing_interval?: string | null;
}): number {
    const planCode = sub.plan_code || 'FREE';
    if (planCode === 'FREE') return 0;

    const charged = Number(sub.price_amount_q);
    if (Number.isFinite(charged) && charged > 0) {
        switch (sub.billing_interval) {
            case 'yearly':
                return charged / 12;
            case 'quarterly':
            case 'pass_90d':
                return charged / 3;
            case 'pass_30d':
            case 'monthly':
            default:
                return charged;
        }
    }

    // Catalog fallback when legacy rows lack price_amount_q.
    if (planCode === 'PRO' || planCode === 'BUSINESS') {
        switch (sub.billing_interval) {
            case 'yearly':
                return monthlyEquivalent('PRO_ANNUAL');
            case 'quarterly':
                return monthlyEquivalent('PRO_QUARTERLY');
            case 'pass_90d':
                return monthlyEquivalent('PRO_PASS_90D');
            case 'pass_30d':
            case 'monthly':
            default:
                return getProVariant('PRO_MONTHLY').priceQ;
        }
    }

    return 0;
}

// ============================================
// TYPES
// ============================================

export interface StandardReport {
    id: string;
    name: string;
    description: string;
    icon: string;
}

export interface TableInfo {
    name: string;
    label: string;
    description: string;
}

export interface ColumnInfo {
    name: string;
    type: string;
    label: string;
}

export interface CustomReportConfig {
    table: string;
    columns: string[];
    dateColumn?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
}

// ============================================
// STANDARD REPORTS DEFINITIONS
// ============================================

const STANDARD_REPORTS: StandardReport[] = [
    {
        id: 'users',
        name: 'Reporte de Usuarios',
        description: 'Lista completa de usuarios con plan, fecha de registro y estado',
        icon: 'Users',
    },
    {
        id: 'debts',
        name: 'Reporte de Deudas',
        description: 'Todas las deudas registradas con acreedor, saldo y estado',
        icon: 'CreditCard',
    },
    {
        id: 'payments',
        name: 'Reporte de Pagos',
        description: 'Historial de pagos realizados por usuarios',
        icon: 'DollarSign',
    },
    {
        id: 'subscriptions',
        name: 'Reporte de Suscripciones',
        description: 'Estado de suscripciones por usuario y plan',
        icon: 'Crown',
    },
    {
        id: 'alerts',
        name: 'Reporte de Alertas',
        description: 'Alertas generadas por el sistema',
        icon: 'Bell',
    },
    {
        id: 'mrr',
        name: 'Reporte MRR',
        description: 'Ingresos mensuales recurrentes por período',
        icon: 'TrendingUp',
    },
    {
        id: 'gtm_scorecard',
        name: 'Scorecard GTM',
        description: 'Embudo semanal por canal, campaña, creativo, partner, variante, estrategia y journey',
        icon: 'TrendingUp',
    },
];

// ============================================
// AVAILABLE TABLES FOR CUSTOM REPORTS
// ============================================

const AVAILABLE_TABLES: TableInfo[] = [
    { name: 'user_profiles', label: 'Perfiles de Usuario', description: 'Configuración de usuarios' },
    { name: 'debts', label: 'Deudas', description: 'Deudas registradas' },
    { name: 'payments', label: 'Pagos', description: 'Pagos realizados' },
    { name: 'income_events', label: 'Ingresos', description: 'Eventos de ingreso' },
    { name: 'essential_expenses', label: 'Gastos Fijos', description: 'Gastos esenciales mensuales' },
    { name: 'variable_budget_targets', label: 'Presupuestos', description: 'Metas de presupuesto variable' },
    { name: 'plans', label: 'Planes de Pago', description: 'Planes generados' },
    { name: 'subscriptions', label: 'Suscripciones', description: 'Suscripciones de usuarios' },
    { name: 'marketing_funnel_events', label: 'Eventos de Funnel GTM', description: 'Eventos de adquisición, conversión y recovery' },
    { name: 'alerts', label: 'Alertas', description: 'Alertas del sistema' },
    { name: 'support_tickets', label: 'Tickets de Soporte', description: 'Tickets de soporte' },
    { name: 'admin_audit_logs', label: 'Logs de Auditoría', description: 'Registro de acciones admin' },
];

// Column definitions per table
const TABLE_COLUMNS: Record<string, ColumnInfo[]> = {
    user_profiles: [
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'currency_base', type: 'text', label: 'Moneda Base' },
        { name: 'pay_frequency', type: 'text', label: 'Frecuencia de Pago' },
        { name: 'goal_type', type: 'text', label: 'Tipo de Meta' },
        { name: 'onboarding_completed', type: 'boolean', label: 'Onboarding Completo' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    debts: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'type', type: 'text', label: 'Tipo' },
        { name: 'creditor', type: 'text', label: 'Acreedor' },
        { name: 'balance', type: 'decimal', label: 'Saldo' },
        { name: 'currency', type: 'text', label: 'Moneda' },
        { name: 'apr', type: 'decimal', label: 'APR (%)' },
        { name: 'min_payment', type: 'decimal', label: 'Pago Mínimo' },
        { name: 'status', type: 'text', label: 'Estado' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    payments: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'debt_id', type: 'uuid', label: 'Debt ID' },
        { name: 'amount', type: 'decimal', label: 'Monto' },
        { name: 'currency', type: 'text', label: 'Moneda' },
        { name: 'payment_date', type: 'date', label: 'Fecha de Pago' },
        { name: 'method', type: 'text', label: 'Método' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    income_events: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'date', type: 'date', label: 'Fecha' },
        { name: 'amount', type: 'decimal', label: 'Monto' },
        { name: 'currency', type: 'text', label: 'Moneda' },
        { name: 'type', type: 'text', label: 'Tipo' },
        { name: 'notes', type: 'text', label: 'Notas' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    essential_expenses: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'name', type: 'text', label: 'Nombre' },
        { name: 'amount', type: 'decimal', label: 'Monto' },
        { name: 'frequency', type: 'text', label: 'Frecuencia' },
        { name: 'currency', type: 'text', label: 'Moneda' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    variable_budget_targets: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'category', type: 'text', label: 'Categoría' },
        { name: 'amount', type: 'decimal', label: 'Monto' },
        { name: 'period', type: 'text', label: 'Período' },
        { name: 'currency', type: 'text', label: 'Moneda' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    plans: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'strategy', type: 'text', label: 'Estrategia' },
        { name: 'engine_version', type: 'text', label: 'Versión Motor' },
        { name: 'active', type: 'boolean', label: 'Activo' },
        { name: 'eta_debt_free', type: 'date', label: 'Fecha Libre de Deuda' },
        { name: 'interest_estimate', type: 'decimal', label: 'Interés Estimado' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    subscriptions: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'plan_code', type: 'text', label: 'Plan' },
        { name: 'status', type: 'text', label: 'Estado' },
        { name: 'provider', type: 'text', label: 'Proveedor' },
        { name: 'start_at', type: 'timestamp', label: 'Fecha Inicio' },
        { name: 'renew_at', type: 'timestamp', label: 'Fecha Renovación' },
    ],
    marketing_funnel_events: [
        { name: 'occurred_at', type: 'timestamp', label: 'Fecha Evento' },
        { name: 'event_name', type: 'text', label: 'Evento' },
        { name: 'attribution_id', type: 'text', label: 'Attribution ID' },
        { name: 'source', type: 'text', label: 'Source' },
        { name: 'medium', type: 'text', label: 'Medium' },
        { name: 'referral_code', type: 'text', label: 'Referral Code' },
        { name: 'campaign_id', type: 'text', label: 'Campaign ID' },
        { name: 'partner_slug', type: 'text', label: 'Partner Slug' },
        { name: 'landing_variant', type: 'text', label: 'Landing Variant' },
        { name: 'offer_variant', type: 'text', label: 'Offer Variant' },
        { name: 'cta_context', type: 'text', label: 'CTA Context' },
        { name: 'plan_strategy', type: 'text', label: 'Plan Strategy' },
        { name: 'metadata', type: 'jsonb', label: 'Metadata' },
    ],
    alerts: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'type', type: 'text', label: 'Tipo' },
        { name: 'severity', type: 'text', label: 'Severidad' },
        { name: 'message', type: 'text', label: 'Mensaje' },
        { name: 'status', type: 'text', label: 'Estado' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    support_tickets: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'user_id', type: 'uuid', label: 'User ID' },
        { name: 'subject', type: 'text', label: 'Asunto' },
        { name: 'status', type: 'text', label: 'Estado' },
        { name: 'priority', type: 'text', label: 'Prioridad' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
    admin_audit_logs: [
        { name: 'id', type: 'uuid', label: 'ID' },
        { name: 'admin_user_id', type: 'uuid', label: 'Admin ID' },
        { name: 'action', type: 'text', label: 'Acción' },
        { name: 'entity_type', type: 'text', label: 'Tipo Recurso' },
        { name: 'entity_id', type: 'text', label: 'ID Recurso' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
};

// Custom reports select from a fixed allow-list of Drizzle tables; the UI
// table/column names above stay in DB (snake_case) form and are resolved
// against the real column metadata before any query is built.
const CUSTOM_REPORT_TABLES: Record<string, PgTable> = {
    user_profiles: schema.userProfiles,
    debts: schema.debts,
    payments: schema.payments,
    income_events: schema.incomeEvents,
    essential_expenses: schema.essentialExpenses,
    variable_budget_targets: schema.variableBudgetTargets,
    plans: schema.plans,
    subscriptions: schema.subscriptions,
    marketing_funnel_events: schema.marketingFunnelEvents,
    alerts: schema.alerts,
    support_tickets: schema.supportTickets,
    admin_audit_logs: schema.auditLogs,
};

// ============================================
// GET STANDARD REPORTS LIST
// ============================================

export async function getStandardReports(): Promise<StandardReport[]> {
    await requirePermission('reports:read');
    return STANDARD_REPORTS;
}

// ============================================
// GENERATE STANDARD REPORT
// ============================================

export async function generateStandardReport(
    reportId: string,
    startDate?: string,
    endDate?: string
): Promise<{ headers: string[]; rows: string[][] }> {
    await requirePermission('reports:read');

    switch (reportId) {
        case 'users':
            return await generateUsersReport();
        case 'debts':
            return await generateDebtsReport(startDate, endDate);
        case 'payments':
            return await generatePaymentsReport(startDate, endDate);
        case 'subscriptions':
            return await generateSubscriptionsReport();
        case 'alerts':
            return await generateAlertsReport(startDate, endDate);
        case 'mrr':
            return await generateMRRReport();
        case 'gtm_scorecard':
            return await generateGtmScorecardReport(startDate, endDate);
        default:
            throw new Error(`Unknown report: ${reportId}`);
    }
}

// ============================================
// STANDARD REPORT GENERATORS
// ============================================

async function generateUsersReport() {
    const db = getDb();
    const { listIdentityUsers } = await import('@/lib/auth/identity');
    const { users: identityUsers } = await listIdentityUsers({ page: 1, perPage: 1000 });

    const [profiles, subs, activeDebts] = await Promise.all([
        db
            .select({
                userId: schema.userProfiles.userId,
                currencyBase: schema.userProfiles.currencyBase,
                onboardingCompleted: schema.userProfiles.onboardingCompleted,
            })
            .from(schema.userProfiles),
        db
            .select({
                userId: schema.subscriptions.userId,
                planCode: schema.subscriptions.planCode,
                status: schema.subscriptions.status,
            })
            .from(schema.subscriptions),
        db
            .select({ userId: schema.debts.userId })
            .from(schema.debts)
            .where(eq(schema.debts.status, 'ACTIVE')),
    ]);

    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    const subMap = new Map(subs.map(s => [s.userId, s]));
    const debtCountMap = new Map<string, number>();
    activeDebts.forEach(d => {
        debtCountMap.set(d.userId, (debtCountMap.get(d.userId) || 0) + 1);
    });

    const headers = ['Email', 'Plan', 'Estado Suscripción', 'Moneda', 'Onboarding', 'Deudas Activas', 'Fecha Registro', 'Último Login'];

    const rows = identityUsers.map(user => {
        const profile = profileMap.get(user.id);
        const sub = subMap.get(user.id);
        return [
            user.email || '',
            sub?.planCode || 'FREE',
            sub?.status || 'N/A',
            profile?.currencyBase || 'GTQ',
            profile?.onboardingCompleted ? 'Sí' : 'No',
            String(debtCountMap.get(user.id) || 0),
            user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-GT') : '',
            user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('es-GT') : 'Nunca',
        ];
    });

    return { headers, rows };
}

async function generateDebtsReport(startDate?: string, endDate?: string) {
    const conditions: SQL[] = [];
    if (startDate) conditions.push(gte(schema.debts.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(schema.debts.createdAt, new Date(endDate)));

    const debts = await getDb()
        .select({
            userId: schema.debts.userId,
            type: schema.debts.type,
            creditor: schema.debts.creditor,
            balance: schema.debts.balance,
            currency: schema.debts.currency,
            apr: schema.debts.apr,
            minPayment: schema.debts.minPayment,
            status: schema.debts.status,
            createdAt: schema.debts.createdAt,
        })
        .from(schema.debts)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(schema.debts.createdAt));

    const headers = ['User ID', 'Tipo', 'Acreedor', 'Saldo', 'Moneda', 'APR (%)', 'Pago Mínimo', 'Estado', 'Fecha Creación'];

    const rows = debts.map(d => [
        d.userId.substring(0, 8) + '...',
        d.type,
        d.creditor,
        String(d.balance),
        d.currency,
        String(d.apr || 0),
        String(d.minPayment),
        d.status,
        d.createdAt.toLocaleDateString('es-GT'),
    ]);

    return { headers, rows };
}

async function generatePaymentsReport(startDate?: string, endDate?: string) {
    const conditions: SQL[] = [];
    if (startDate) conditions.push(gte(schema.payments.paymentDate, startDate));
    if (endDate) conditions.push(lte(schema.payments.paymentDate, endDate));

    const payments = await getDb()
        .select({
            userId: schema.payments.userId,
            amount: schema.payments.amount,
            currency: schema.payments.currency,
            paymentDate: schema.payments.paymentDate,
            method: schema.payments.method,
            creditor: schema.debts.creditor,
        })
        .from(schema.payments)
        .leftJoin(schema.debts, eq(schema.debts.id, schema.payments.debtId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(schema.payments.paymentDate));

    const headers = ['User ID', 'Acreedor', 'Monto', 'Moneda', 'Fecha Pago', 'Método'];

    const rows = payments.map(p => [
        p.userId.substring(0, 8) + '...',
        p.creditor || 'N/A',
        String(p.amount),
        p.currency,
        new Date(p.paymentDate).toLocaleDateString('es-GT'),
        p.method || 'N/A',
    ]);

    return { headers, rows };
}

async function generateSubscriptionsReport() {
    const subs = await getDb()
        .select({
            userId: schema.subscriptions.userId,
            planCode: schema.subscriptions.planCode,
            status: schema.subscriptions.status,
            provider: schema.subscriptions.provider,
            startAt: schema.subscriptions.startAt,
            renewAt: schema.subscriptions.renewAt,
            cancelAt: schema.subscriptions.cancelAt,
        })
        .from(schema.subscriptions)
        .orderBy(desc(schema.subscriptions.startAt));

    const headers = ['User ID', 'Plan', 'Estado', 'Proveedor', 'Fecha Inicio', 'Fecha Renovación', 'Fecha Cancelación'];

    const rows = subs.map(s => [
        s.userId.substring(0, 8) + '...',
        s.planCode,
        s.status,
        s.provider,
        s.startAt ? s.startAt.toLocaleDateString('es-GT') : '',
        s.renewAt ? s.renewAt.toLocaleDateString('es-GT') : 'N/A',
        s.cancelAt ? s.cancelAt.toLocaleDateString('es-GT') : 'N/A',
    ]);

    return { headers, rows };
}

async function generateAlertsReport(startDate?: string, endDate?: string) {
    const headers = ['User ID', 'Tipo', 'Severidad', 'Mensaje', 'Estado', 'Fecha Creación'];

    try {
        const alerts = await drizzleListAlertsForReport({ startDate, endDate });
        const rows = alerts.map((a) => [
            a.user_id.substring(0, 8) + '...',
            a.type,
            a.severity,
            a.message.substring(0, 50) + (a.message.length > 50 ? '...' : ''),
            a.status,
            new Date(a.created_at).toLocaleDateString('es-GT'),
        ]);
        return { headers, rows };
    } catch (error) {
        console.error('Error generating alerts report:', error);
        return { headers, rows: [] };
    }
}

async function generateMRRReport() {
    const subs = await getDb()
        .select({
            planCode: schema.subscriptions.planCode,
            startAt: schema.subscriptions.startAt,
            priceAmountQ: schema.subscriptions.priceAmountQ,
            billingInterval: schema.subscriptions.billingInterval,
        })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, 'ACTIVE'));

    const normalized = subs.map((s) => ({
        plan_code: s.planCode,
        price_amount_q: s.priceAmountQ,
        billing_interval: s.billingInterval,
        start_at: s.startAt,
    }));

    // Group by month
    const monthlyData = new Map<string, { count: number; mrr: number }>();

    normalized.forEach(s => {
        const month = s.start_at ? s.start_at.toISOString().substring(0, 7) : 'Unknown';
        const current = monthlyData.get(month) || { count: 0, mrr: 0 };
        current.count++;
        current.mrr += monthlyRevenueFromSubscription(s);
        monthlyData.set(month, current);
    });

    // Calculate current MRR from catalog/charged amounts (not invented tiers)
    const currentMRR = normalized.reduce((sum, s) => sum + monthlyRevenueFromSubscription(s), 0);

    const headers = ['Mes', 'Suscripciones Activas', 'MRR (Q)'];

    // Add current totals row first
    const rows: string[][] = [
        ['TOTAL ACTUAL', String(normalized.length), `Q${currentMRR.toLocaleString()}`],
    ];

    // Add monthly breakdown
    Array.from(monthlyData.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([month, data]) => {
            rows.push([month, String(data.count), `Q${data.mrr.toLocaleString()}`]);
        });

    return { headers, rows };
}

async function generateGtmScorecardReport(startDate?: string, endDate?: string) {
    const effectiveStart = startDate || new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10);
    const effectiveEnd = endDate || new Date().toISOString().slice(0, 10);

    const rows = await getDb()
        .select({
            occurred_at: schema.marketingFunnelEvents.occurredAt,
            event_name: schema.marketingFunnelEvents.eventName,
            attribution_id: schema.marketingFunnelEvents.attributionId,
            tenant_id: schema.marketingFunnelEvents.tenantId,
            source: schema.marketingFunnelEvents.source,
            medium: schema.marketingFunnelEvents.medium,
            referral_code: schema.marketingFunnelEvents.referralCode,
            campaign_id: schema.marketingFunnelEvents.campaignId,
            campaign_name: schema.marketingFunnelEvents.campaignName,
            creative_id: schema.marketingFunnelEvents.creativeId,
            creative_name: schema.marketingFunnelEvents.creativeName,
            partner_slug: schema.marketingFunnelEvents.partnerSlug,
            landing_variant: schema.marketingFunnelEvents.landingVariant,
            offer_variant: schema.marketingFunnelEvents.offerVariant,
            cta_context: schema.marketingFunnelEvents.ctaContext,
            plan_strategy: schema.marketingFunnelEvents.planStrategy,
            metadata: schema.marketingFunnelEvents.metadata,
        })
        .from(schema.marketingFunnelEvents)
        .where(
            and(
                gte(schema.marketingFunnelEvents.occurredAt, new Date(effectiveStart)),
                lte(schema.marketingFunnelEvents.occurredAt, new Date(`${effectiveEnd}T23:59:59.999Z`)),
            ),
        )
        .orderBy(asc(schema.marketingFunnelEvents.occurredAt));

    const events = rows.map((row) => ({
        ...row,
        occurred_at: row.occurred_at.toISOString(),
        metadata: (row.metadata ?? null) as Json | null,
    }));

    return {
        headers: GTM_SCORECARD_HEADERS,
        rows: buildGtmScorecardRows(events),
    };
}

// ============================================
// CUSTOM REPORT FUNCTIONS
// ============================================

export async function getAvailableTables(): Promise<TableInfo[]> {
    await requirePermission('reports:read');
    return AVAILABLE_TABLES;
}

export async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    await requirePermission('reports:read');

    // Validate table name to prevent injection
    if (!AVAILABLE_TABLES.some(t => t.name === tableName)) {
        throw new Error('Invalid table name');
    }

    return TABLE_COLUMNS[tableName] || [];
}

export async function generateCustomReport(
    config: CustomReportConfig
): Promise<{ headers: string[]; rows: string[][] }> {
    await requirePermission('reports:read');

    // Validate table name
    const table = CUSTOM_REPORT_TABLES[config.table];
    if (!table || !AVAILABLE_TABLES.some(t => t.name === config.table)) {
        throw new Error('Invalid table name');
    }

    // Validate columns
    const validColumns = TABLE_COLUMNS[config.table]?.map(c => c.name) || [];
    const tableColumns = getDrizzleTableColumns(table);
    const columnByDbName = new Map(
        Object.values(tableColumns).map((column) => [column.name, column]),
    );

    const selectedColumns = config.columns.filter(
        (c) => validColumns.includes(c) && columnByDbName.has(c),
    );

    if (selectedColumns.length === 0) {
        throw new Error('No valid columns selected');
    }

    const selection = Object.fromEntries(
        selectedColumns.map((col) => [col, columnByDbName.get(col)!]),
    );

    const conditions: SQL[] = [];
    if (config.dateColumn && columnByDbName.has(config.dateColumn)) {
        const dateColumn = columnByDbName.get(config.dateColumn)!;
        // `date` columns compare as ISO strings, timestamps as Date instances.
        const coerce = (value: string) =>
            dateColumn.columnType === 'PgDate' ? value : new Date(value);
        if (config.startDate) conditions.push(gte(dateColumn, coerce(config.startDate)));
        if (config.endDate) conditions.push(lte(dateColumn, coerce(config.endDate)));
    }

    const data = await getDb()
        .select(selection)
        .from(table)
        .where(conditions.length ? and(...conditions) : undefined)
        .limit(config.limit || 1000);

    // Get column labels for headers
    const columnDefs = TABLE_COLUMNS[config.table] || [];
    const headers = selectedColumns.map(col => {
        const def = columnDefs.find(c => c.name === col);
        return def?.label || col;
    });

    // Format rows
    const rows = data.map((row: Record<string, unknown>) =>
        selectedColumns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            if (typeof value === 'boolean') return value ? 'Sí' : 'No';
            if (value instanceof Date) return value.toLocaleDateString('es-GT');
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                return new Date(value).toLocaleDateString('es-GT');
            }
            return String(value);
        })
    );

    return { headers, rows };
}
