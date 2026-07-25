'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { buildGtmScorecardRows, GTM_SCORECARD_HEADERS } from '@/lib/funnel/scorecard';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { drizzleListAlertsForReport } from '@/lib/support/drizzle';
import { requirePermission } from './admin-auth';

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
        { name: 'admin_id', type: 'uuid', label: 'Admin ID' },
        { name: 'action', type: 'text', label: 'Acción' },
        { name: 'resource_type', type: 'text', label: 'Tipo Recurso' },
        { name: 'resource_id', type: 'text', label: 'ID Recurso' },
        { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
    ],
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
    const supabase = createAdminClient();

    switch (reportId) {
        case 'users':
            return await generateUsersReport(supabase);
        case 'debts':
            return await generateDebtsReport(supabase, startDate, endDate);
        case 'payments':
            return await generatePaymentsReport(supabase, startDate, endDate);
        case 'subscriptions':
            return await generateSubscriptionsReport(supabase);
        case 'alerts':
            return await generateAlertsReport(supabase, startDate, endDate);
        case 'mrr':
            return await generateMRRReport(supabase);
        case 'gtm_scorecard':
            return await generateGtmScorecardReport(supabase, startDate, endDate);
        default:
            throw new Error(`Unknown report: ${reportId}`);
    }
}

// ============================================
// STANDARD REPORT GENERATORS
// ============================================

async function generateUsersReport(supabase: ReturnType<typeof createAdminClient>) {
    const { listIdentityUsers } = await import('@/lib/auth/identity');
    const { users: identityUsers } = await listIdentityUsers({ page: 1, perPage: 1000 });
    const users = {
        users: identityUsers.map((u) => ({
            id: u.id,
            email: u.email,
            created_at: u.createdAt,
            last_sign_in_at: u.lastSignInAt,
            email_confirmed_at: u.emailVerified ? u.createdAt : null,
            user_metadata: { full_name: u.name, name: u.name },
        })),
    };

    const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, currency_base, onboarding_completed, created_at');

    const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id, plan_code, status');

    const { data: debtCounts } = await supabase
        .from('debts')
        .select('user_id')
        .eq('status', 'ACTIVE');

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const subMap = new Map(subs?.map(s => [s.user_id, s]) || []);
    const debtCountMap = new Map<string, number>();
    debtCounts?.forEach(d => {
        debtCountMap.set(d.user_id, (debtCountMap.get(d.user_id) || 0) + 1);
    });

    const headers = ['Email', 'Plan', 'Estado Suscripción', 'Moneda', 'Onboarding', 'Deudas Activas', 'Fecha Registro', 'Último Login'];

    const rows = users?.users.map(user => {
        const profile = profileMap.get(user.id);
        const sub = subMap.get(user.id);
        return [
            user.email || '',
            (sub as any)?.plan_code || 'FREE',
            (sub as any)?.status || 'N/A',
            (profile as any)?.currency_base || 'GTQ',
            (profile as any)?.onboarding_completed ? 'Sí' : 'No',
            String(debtCountMap.get(user.id) || 0),
            user.created_at ? new Date(user.created_at).toLocaleDateString('es-GT') : '',
            user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es-GT') : 'Nunca',
        ];
    }) || [];

    return { headers, rows };
}

async function generateDebtsReport(
    supabase: ReturnType<typeof createAdminClient>,
    startDate?: string,
    endDate?: string
) {
    let query = supabase
        .from('debts')
        .select('user_id, type, creditor, balance, currency, apr, min_payment, status, created_at');

    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }

    const { data: debts } = await query.order('created_at', { ascending: false });

    const headers = ['User ID', 'Tipo', 'Acreedor', 'Saldo', 'Moneda', 'APR (%)', 'Pago Mínimo', 'Estado', 'Fecha Creación'];

    const rows = debts?.map(d => [
        d.user_id.substring(0, 8) + '...',
        d.type,
        d.creditor,
        String(d.balance),
        d.currency,
        String(d.apr || 0),
        String(d.min_payment),
        d.status,
        new Date(d.created_at).toLocaleDateString('es-GT'),
    ]) || [];

    return { headers, rows };
}

async function generatePaymentsReport(
    supabase: ReturnType<typeof createAdminClient>,
    startDate?: string,
    endDate?: string
) {
    let query = supabase
        .from('payments')
        .select(`
            user_id,
            amount,
            currency,
            payment_date,
            method,
            debt:debts(creditor)
        `);

    if (startDate) {
        query = query.gte('payment_date', startDate);
    }
    if (endDate) {
        query = query.lte('payment_date', endDate);
    }

    const { data: payments } = await query.order('payment_date', { ascending: false });

    const headers = ['User ID', 'Acreedor', 'Monto', 'Moneda', 'Fecha Pago', 'Método'];

    const rows = payments?.map(p => [
        p.user_id.substring(0, 8) + '...',
        (p.debt as { creditor: string } | null)?.creditor || 'N/A',
        String(p.amount),
        p.currency,
        new Date(p.payment_date).toLocaleDateString('es-GT'),
        p.method || 'N/A',
    ]) || [];

    return { headers, rows };
}

async function generateSubscriptionsReport(supabase: ReturnType<typeof createAdminClient>) {
    const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id, plan_code, status, provider, start_at, renew_at, cancel_at')
        .order('start_at', { ascending: false });

    const headers = ['User ID', 'Plan', 'Estado', 'Proveedor', 'Fecha Inicio', 'Fecha Renovación', 'Fecha Cancelación'];

    const rows = subs?.map(s => [
        s.user_id.substring(0, 8) + '...',
        s.plan_code,
        s.status,
        s.provider,
        s.start_at ? new Date(s.start_at).toLocaleDateString('es-GT') : '',
        s.renew_at ? new Date(s.renew_at).toLocaleDateString('es-GT') : 'N/A',
        s.cancel_at ? new Date(s.cancel_at).toLocaleDateString('es-GT') : 'N/A',
    ]) || [];

    return { headers, rows };
}

async function generateAlertsReport(
    supabase: ReturnType<typeof createAdminClient>,
    startDate?: string,
    endDate?: string
) {
    const headers = ['User ID', 'Tipo', 'Severidad', 'Mensaje', 'Estado', 'Fecha Creación'];

    if (isDrizzleEnabled()) {
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
            console.error('Error generating alerts report (drizzle):', error);
            return { headers, rows: [] };
        }
    }

    let query = supabase
        .from('alerts')
        .select('user_id, type, severity, message, status, created_at');

    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }

    const { data: alerts } = await query.order('created_at', { ascending: false });

    const rows = alerts?.map(a => [
        a.user_id.substring(0, 8) + '...',
        a.type,
        a.severity,
        a.message.substring(0, 50) + (a.message.length > 50 ? '...' : ''),
        a.status,
        new Date(a.created_at).toLocaleDateString('es-GT'),
    ]) || [];

    return { headers, rows };
}

async function generateMRRReport(supabase: ReturnType<typeof createAdminClient>) {
    // Get active subscriptions grouped by month
    const { data: subs } = await supabase
        .from('subscriptions')
        .select('plan_code, status, start_at')
        .eq('status', 'ACTIVE');

    // Plan prices (GTQ)
    const planPrices: Record<string, number> = {
        FREE: 0,
        PRO: 99,
        BUSINESS: 299,
    };

    // Group by month
    const monthlyData = new Map<string, { count: number; mrr: number }>();

    subs?.forEach(s => {
        const month = s.start_at ? new Date(s.start_at).toISOString().substring(0, 7) : 'Unknown';
        const current = monthlyData.get(month) || { count: 0, mrr: 0 };
        current.count++;
        current.mrr += planPrices[s.plan_code] || 0;
        monthlyData.set(month, current);
    });

    // Calculate current MRR
    const currentMRR = subs?.reduce((sum, s) => sum + (planPrices[s.plan_code] || 0), 0) || 0;

    const headers = ['Mes', 'Suscripciones Activas', 'MRR (Q)'];

    // Add current totals row first
    const rows: string[][] = [
        ['TOTAL ACTUAL', String(subs?.length || 0), `Q${currentMRR.toLocaleString()}`],
    ];

    // Add monthly breakdown
    Array.from(monthlyData.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([month, data]) => {
            rows.push([month, String(data.count), `Q${data.mrr.toLocaleString()}`]);
        });

    return { headers, rows };
}

async function generateGtmScorecardReport(
    supabase: ReturnType<typeof createAdminClient>,
    startDate?: string,
    endDate?: string
) {
    const effectiveStart = startDate || new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10);
    const effectiveEnd = endDate || new Date().toISOString().slice(0, 10);

    const { data: events, error } = await supabase
        .from('marketing_funnel_events')
        .select('occurred_at, event_name, attribution_id, tenant_id, source, medium, referral_code, campaign_id, campaign_name, creative_id, creative_name, partner_slug, landing_variant, offer_variant, cta_context, plan_strategy, metadata')
        .gte('occurred_at', effectiveStart)
        .lte('occurred_at', `${effectiveEnd}T23:59:59.999Z`)
        .order('occurred_at', { ascending: true });

    if (error) {
        throw new Error(`Query error: ${error.message}`);
    }

    return {
        headers: GTM_SCORECARD_HEADERS,
        rows: buildGtmScorecardRows(events || []),
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
    const supabase = createAdminClient();

    // Validate table name
    if (!AVAILABLE_TABLES.some(t => t.name === config.table)) {
        throw new Error('Invalid table name');
    }

    // Validate columns
    const validColumns = TABLE_COLUMNS[config.table]?.map(c => c.name) || [];
    const selectedColumns = config.columns.filter(c => validColumns.includes(c));

    if (selectedColumns.length === 0) {
        throw new Error('No valid columns selected');
    }

    // Build query - use type assertion for validated dynamic table name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
        .from(config.table)
        .select(selectedColumns.join(','));

    // Apply date filter if specified
    if (config.dateColumn && config.startDate) {
        query = query.gte(config.dateColumn, config.startDate);
    }
    if (config.dateColumn && config.endDate) {
        query = query.lte(config.dateColumn, config.endDate);
    }

    // Apply limit
    query = query.limit(config.limit || 1000);

    const { data, error } = await query;

    if (error) {
        throw new Error(`Query error: ${error.message}`);
    }

    // Get column labels for headers
    const columnDefs = TABLE_COLUMNS[config.table] || [];
    const headers = selectedColumns.map(col => {
        const def = columnDefs.find(c => c.name === col);
        return def?.label || col;
    });

    // Format rows
    const rows = (data || []).map((row: Record<string, unknown>) =>
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
