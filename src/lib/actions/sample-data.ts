'use server';

import { revalidatePath } from 'next/cache';
import { requireUserTenant } from '@/lib/tenant/server';
import { SAMPLE_DATA_PREFIX } from '@/lib/constants/sample-data';
import { CACHE_TAGS, invalidateCacheByTag } from '@/lib/cache/next-cache';
import { invalidateInsightsCache } from '@/lib/insights';

/**
 * Sample-data preview for new users ("Ver con datos de ejemplo").
 *
 * Unlike `seedTestData` (admin-only, requires the `seed:run` permission and
 * seeds a full test account), this action is callable by any authenticated
 * user on their OWN tenant, seeds a small realistic Guatemalan profile
 * (3 debts + 1 income) and marks every row with SAMPLE_DATA_PREFIX in
 * `notes` so it can be identified and removed later.
 */

async function invalidateDebtCaches(tenantId: string, userId: string) {
    await invalidateCacheByTag(CACHE_TAGS.USER_DEBTS);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_PROJECTION);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_FORECAST);
    await invalidateInsightsCache(tenantId, userId);

    revalidatePath('/dashboard');
    revalidatePath('/debts');
    revalidatePath('/plan');
}

export async function seedSampleData(): Promise<
    { success: true } | { success: false; error: string }
> {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Only seed into an empty account: the preview exists so a brand-new user
    // can see payoff output without hand-entering debts. Never mix samples
    // with real data.
    const { count: existingDebts, error: countError } = await supabase
        .from('debts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (countError) {
        return { success: false, error: 'No pudimos verificar tus deudas. Intentá de nuevo.' };
    }

    if ((existingDebts ?? 0) > 0) {
        return {
            success: false,
            error: 'Ya tenés deudas registradas, no agregamos datos de ejemplo.',
        };
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const nextPaymentDate = nextMonth.toISOString().split('T')[0];

    // Realistic GT sample profile
    const debtsToInsert = [
        {
            tenant_id: tenantId,
            user_id: user.id,
            type: 'CREDIT_CARD',
            creditor: 'Tarjeta BI',
            balance: 9200.0,
            currency: 'GTQ',
            apr: 45.0,
            min_payment: 350.0,
            statement_date: 20,
            due_date: 5,
            next_payment_date: nextPaymentDate,
            status: 'ACTIVE',
            notes: `${SAMPLE_DATA_PREFIX} Tarjeta de crédito de ejemplo`,
        },
        {
            tenant_id: tenantId,
            user_id: user.id,
            type: 'LOAN',
            creditor: 'Préstamo Banrural',
            balance: 5800.0,
            currency: 'GTQ',
            apr: 24.0,
            min_payment: 200.0,
            due_date: 15,
            next_payment_date: nextPaymentDate,
            status: 'ACTIVE',
            notes: `${SAMPLE_DATA_PREFIX} Préstamo personal de ejemplo`,
        },
        {
            tenant_id: tenantId,
            user_id: user.id,
            type: 'INSTALLMENT',
            creditor: 'Cuotas Cemaco',
            balance: 3000.0,
            currency: 'GTQ',
            apr: 0.0,
            min_payment: 250.0,
            due_date: 28,
            next_payment_date: nextPaymentDate,
            installment_count: 12,
            installments_left: 12,
            fixed_payment: 250.0,
            status: 'ACTIVE',
            notes: `${SAMPLE_DATA_PREFIX} Compra en cuotas de ejemplo`,
        },
    ];

    const { error: debtsError } = await supabase.from('debts').insert(debtsToInsert);

    if (debtsError) {
        console.error('Error seeding sample debts:', debtsError);
        return { success: false, error: 'No pudimos crear los datos de ejemplo. Intentá de nuevo.' };
    }

    const { error: incomeError } = await supabase.from('income_events').insert([
        {
            tenant_id: tenantId,
            user_id: user.id,
            date: today,
            amount: 5500.0,
            currency: 'GTQ',
            type: 'FIXED',
            source: 'Salario (ejemplo)',
            notes: `${SAMPLE_DATA_PREFIX} Salario mensual de ejemplo`,
        },
    ]);

    if (incomeError) {
        console.error('Error seeding sample income:', incomeError);
        // Debts already exist, so the preview still works; report success but log.
    }

    await invalidateDebtCaches(tenantId, user.id);

    return { success: true };
}

/**
 * Delete every row previously created by `seedSampleData` (identified by the
 * SAMPLE_DATA_PREFIX marker in `notes`), scoped to the current tenant/user.
 */
export async function clearSampleData(): Promise<
    { success: true } | { success: false; error: string }
> {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { data: sampleDebts, error: findError } = await supabase
        .from('debts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .like('notes', `${SAMPLE_DATA_PREFIX}%`);

    if (findError) {
        console.error('Error finding sample debts:', findError);
        return { success: false, error: 'No pudimos eliminar los datos de ejemplo. Intentá de nuevo.' };
    }

    if (sampleDebts && sampleDebts.length > 0) {
        const { error: deleteDebtsError } = await supabase
            .from('debts')
            .delete()
            .in('id', sampleDebts.map((d) => d.id))
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id);

        if (deleteDebtsError) {
            console.error('Error deleting sample debts:', deleteDebtsError);
            return { success: false, error: 'No pudimos eliminar los datos de ejemplo. Intentá de nuevo.' };
        }
    }

    const { error: deleteIncomeError } = await supabase
        .from('income_events')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .like('notes', `${SAMPLE_DATA_PREFIX}%`);

    if (deleteIncomeError) {
        console.error('Error deleting sample income:', deleteIncomeError);
        return { success: false, error: 'No pudimos eliminar los datos de ejemplo. Intentá de nuevo.' };
    }

    await invalidateDebtCaches(tenantId, user.id);

    return { success: true };
}
