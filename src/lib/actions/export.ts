'use server';

import { checkFeatureAccess } from '@/lib/utils/feature-access';
import { requireUserTenant } from '@/lib/tenant/server';

// ============================================
// EXPORT DEBTS TO CSV
// ============================================

export async function exportDebtsCSV(): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    requiresUpgrade?: boolean;
}> {
    // Check if user has export access
    const { hasAccess } = await checkFeatureAccess('export');
    if (!hasAccess) {
        return {
            success: false,
            error: 'Esta función requiere un plan PRO',
            requiresUpgrade: true,
        };
    }

    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    // PERF-011: Select specific fields instead of *
    const { data: debts, error } = await supabase
        .from('debts')
        .select('id, user_id, type, creditor, balance, currency, apr, min_payment, statement_date, due_date, next_payment_date, installment_count, installments_left, fixed_payment, status, notes, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('balance', { ascending: false });

    if (error) {
        return { success: false, error: 'Error al cargar deudas' };
    }

    if (!debts || debts.length === 0) {
        return { success: false, error: 'No hay deudas para exportar' };
    }

    // Build CSV
    const headers = [
        'Acreedor',
        'Tipo',
        'Saldo',
        'Pago Mínimo',
        'APR %',
        'Día de Pago',
        'Estado',
        'Moneda',
        'Fecha Próximo Pago',
        'Notas',
    ];

    const rows = debts.map(debt => [
        `"${debt.creditor}"`,
        debt.type,
        debt.balance,
        debt.min_payment,
        debt.apr || 0,
        debt.due_date,
        debt.status,
        debt.currency,
        debt.next_payment_date || '',
        `"${(debt.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
    ].join('\n');

    return {
        success: true,
        data: csv,
    };
}

// ============================================
// EXPORT PAYMENTS TO CSV
// ============================================

export async function exportPaymentsCSV(monthsBack: number = 12): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    requiresUpgrade?: boolean;
}> {
    // Check if user has export access
    const { hasAccess } = await checkFeatureAccess('export');
    if (!hasAccess) {
        return {
            success: false,
            error: 'Esta función requiere un plan PRO',
            requiresUpgrade: true,
        };
    }

    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const { data: payments, error } = await supabase
        .from('payments')
        .select(`
            *,
            debts (creditor)
        `)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .order('payment_date', { ascending: false });

    if (error) {
        return { success: false, error: 'Error al cargar pagos' };
    }

    if (!payments || payments.length === 0) {
        return { success: false, error: 'No hay pagos para exportar' };
    }

    // Build CSV
    const headers = [
        'Fecha',
        'Acreedor',
        'Monto',
        'Método',
    ];

    const rows = payments.map(payment => {
        const debts = payment.debts as { creditor: string } | null;
        return [
            payment.payment_date,
            `"${debts?.creditor || 'Desconocido'}"`,
            payment.amount,
            payment.method || 'efectivo',
        ];
    });

    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
    ].join('\n');

    return {
        success: true,
        data: csv,
    };
}

// ============================================
// EXPORT SUMMARY REPORT
// ============================================

export async function exportSummaryReport(): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    requiresUpgrade?: boolean;
}> {
    // Check if user has export access
    const { hasAccess } = await checkFeatureAccess('export');
    if (!hasAccess) {
        return {
            success: false,
            error: 'Esta función requiere un plan PRO',
            requiresUpgrade: true,
        };
    }

    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    // Get debts summary
    const { data: debts } = await supabase
        .from('debts')
        .select('balance, type, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    // Get payments summary
    const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const activeDebts = debts?.filter(d => d.status === 'ACTIVE') || [];
    const paidDebts = debts?.filter(d => d.status === 'PAID_OFF') || [];

    const totalActiveBalance = activeDebts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Build summary report
    const report = [
        'REPORTE DE RESUMEN - RutaCero',
        `Fecha de generación: ${new Date().toLocaleDateString('es-GT')}`,
        '',
        '=== RESUMEN DE DEUDAS ===',
        `Deudas activas: ${activeDebts.length}`,
        `Deudas pagadas: ${paidDebts.length}`,
        `Saldo total activo: Q${totalActiveBalance.toFixed(2)}`,
        '',
        '=== RESUMEN DE PAGOS ===',
        `Total pagado: Q${totalPaid.toFixed(2)}`,
        `Número de pagos: ${payments?.length || 0}`,
        '',
        '=== DEUDAS POR TIPO ===',
        ...['CREDIT_CARD', 'LOAN', 'INSTALLMENT', 'INFORMAL'].map(type => {
            const count = activeDebts.filter(d => d.type === type).length;
            const balance = activeDebts.filter(d => d.type === type).reduce((sum, d) => sum + Number(d.balance), 0);
            return `${type}: ${count} deudas, Q${balance.toFixed(2)}`;
        }),
    ].join('\n');

    return {
        success: true,
        data: report,
    };
}

// ============================================
// EXPORT PLAN REPORT (ADVANCED CSV)
// ============================================

export async function exportPlanReportCSV(): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    requiresUpgrade?: boolean;
}> {
    const { hasAccess } = await checkFeatureAccess('export');
    if (!hasAccess) {
        return {
            success: false,
            error: 'Esta función requiere un plan PRO',
            requiresUpgrade: true,
        };
    }

    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, strategy, eta_debt_free, interest_estimate, avg_payment, horizon_periods, created_at, assumptions')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('active', true)
        .single();

    if (planError || !plan) {
        return { success: false, error: 'No hay un plan activo para exportar' };
    }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('currency_base')
        .eq('user_id', user.id)
        .single();

    const currency = (profile as { currency_base: string } | null)?.currency_base || 'GTQ';

    const { data: planItems, error: itemsError } = await supabase
        .from('plan_items')
        .select(`
            period_start,
            period_end,
            planned_amount,
            currency,
            priority_order,
            is_focus,
            debt:debts (
                creditor,
                type
            )
        `)
        .eq('plan_id', plan.id)
        .eq('tenant_id', tenantId)
        .order('period_start', { ascending: true })
        .order('priority_order', { ascending: true });

    if (itemsError) {
        return { success: false, error: 'Error al cargar detalles del plan' };
    }

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('es-GT', { month: 'short', year: 'numeric' });

    const safeAssumptions = JSON.stringify(plan.assumptions || {}).replace(/"/g, '""');

    const metaRows = [
        ['REPORTE', 'Plan RutaCero'],
        ['Fecha', new Date().toISOString().split('T')[0]],
        ['Moneda base', currency],
        ['Estrategia', plan.strategy],
        ['Creado', new Date(plan.created_at).toISOString().split('T')[0]],
        ['ETA libre de deuda', plan.eta_debt_free ? formatDate(plan.eta_debt_free) : 'N/A'],
        ['Interes estimado', plan.interest_estimate ?? 0],
        ['Pago promedio', plan.avg_payment ?? 0],
        ['Horizonte (meses)', plan.horizon_periods ?? ''],
        ['Supuestos', `"${safeAssumptions}"`],
    ];

    const detailHeaders = [
        'Periodo inicio',
        'Periodo fin',
        'Acreedor',
        'Tipo',
        'Prioridad',
        'Es foco',
        'Monto',
        'Moneda',
    ];

    const detailRows = (planItems || []).map((item) => {
        const debt = item.debt as { creditor?: string; type?: string } | null;
        return [
            item.period_start,
            item.period_end,
            `"${(debt?.creditor || 'N/A').replace(/"/g, '""')}"`,
            debt?.type || 'N/A',
            item.priority_order,
            item.is_focus ? 'SI' : 'NO',
            item.planned_amount,
            item.currency || currency,
        ];
    });

    const csv = [
        ...metaRows.map(row => row.join(',')),
        '',
        detailHeaders.join(','),
        ...detailRows.map(row => row.join(',')),
    ].join('\n');

    return {
        success: true,
        data: csv,
    };
}
