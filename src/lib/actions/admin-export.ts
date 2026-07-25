'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requirePermission, logAdminAction } from './admin-auth';
import { getDisplayName } from '@/lib/auth/display-name';

// ============================================
// EXPORT USERS TO CSV
// ============================================

export async function exportUsersCSV(): Promise<string> {
    const session = await requirePermission('users:read');
    const adminClient = createAdminClient();

    // Log export action
    await logAdminAction(
        session.adminId,
        'EXPORT_USERS_CSV',
        'export',
        'all_users',
        { timestamp: new Date().toISOString() }
    );

    const { listIdentityUsers } = await import('@/lib/auth/identity');
    const authData = await listIdentityUsers({ page: 1, perPage: 1000 });

    if (!authData.users.length) {
        return 'ID,Email,Nombre,Fecha Registro,Último Login,Estado\n';
    }

    // Fetch profiles for onboarding status
    const userIds = authData.users.map(u => u.id);
    const { data: profiles } = await adminClient
        .from('user_profiles')
        .select('user_id, onboarding_completed')
        .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Build CSV content
    const headers = ['ID', 'Email', 'Nombre', 'Fecha Registro', 'Último Login', 'Email Verificado', 'Onboarding', 'Estado'];

    const rows = authData.users.map(user => {
        const profile = profileMap.get(user.id);
        // Use 'N/A' here rather than the email-prefix fallback because this
        // CSV is consumed by ops to spot users who haven't set a real name.
        const displayName = user.name?.trim()
            ? user.name
            : user.raw
              ? getDisplayName(user.raw as Parameters<typeof getDisplayName>[0])
              : 'N/A';
        const createdAt = new Date(user.createdAt).toLocaleDateString('es-GT');
        const lastSignIn = user.lastSignInAt
            ? new Date(user.lastSignInAt).toLocaleDateString('es-GT')
            : 'Nunca';
        const emailVerified = user.emailVerified ? 'Sí' : 'No';
        const onboarding = profile?.onboarding_completed ? 'Completado' : 'Pendiente';

        // Determine status
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isActive = user.lastSignInAt && new Date(user.lastSignInAt) >= thirtyDaysAgo;
        const status = isActive ? 'Activo' : 'Inactivo';

        return [
            user.id,
            user.email || '',
            displayName,
            createdAt,
            lastSignIn,
            emailVerified,
            onboarding,
            status
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}

// ============================================
// EXPORT ANALYTICS TO CSV
// ============================================

export async function exportAnalyticsCSV(): Promise<string> {
    const session = await requirePermission('dashboard:view');
    const adminClient = createAdminClient();

    // Log export action
    await logAdminAction(
        session.adminId,
        'EXPORT_ANALYTICS_CSV',
        'export',
        'analytics',
        { timestamp: new Date().toISOString() }
    );

    // Get date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const { listIdentityUsers } = await import('@/lib/auth/identity');
    const authData = await listIdentityUsers({ page: 1, perPage: 1000 });

    // Group by date
    const dailyData: Record<string, { newUsers: number; payments: number; paymentAmount: number }> = {};

    // Initialize all dates
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dailyData[dateStr] = { newUsers: 0, payments: 0, paymentAmount: 0 };
    }

    // Count new users per day
    authData.users.forEach(user => {
        const dateStr = new Date(user.createdAt).toISOString().split('T')[0];
        if (dailyData[dateStr]) {
            dailyData[dateStr].newUsers++;
        }
    });

    // Fetch payments
    const { data: payments } = await adminClient
        .from('payments')
        .select('payment_date, amount')
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .lte('payment_date', endDate.toISOString().split('T')[0]);

    payments?.forEach(p => {
        const dateStr = p.payment_date;
        if (dailyData[dateStr]) {
            dailyData[dateStr].payments++;
            dailyData[dateStr].paymentAmount += Number(p.amount);
        }
    });

    // Build CSV
    const headers = ['Fecha', 'Nuevos Usuarios', 'Pagos', 'Monto Pagos (Q)'];

    const rows = Object.entries(dailyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => [
            date,
            data.newUsers,
            data.payments,
            data.paymentAmount.toFixed(2)
        ].join(','));

    return [headers.join(','), ...rows].join('\n');
}
