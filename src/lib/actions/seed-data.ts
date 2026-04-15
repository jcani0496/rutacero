'use server';

import { requirePermission } from '@/lib/actions/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { ensureCurrentTenantForUser } from '@/lib/tenant/server';

/**
 * Seed test data for a specific user
 * Uses realistic Guatemalan financial scenarios
 */
export async function seedTestData(userId: string) {
    await requirePermission('seed:run');
    const supabase = await createAdminClient();
    const tenantId = await ensureCurrentTenantForUser(userId);

    // Current date for calculations
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Next month for payment dates
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const nextPaymentDate = nextMonth.toISOString().split('T')[0];

    // ============================================
    // 1. DEBTS - Realistic Guatemalan scenario
    // ============================================
    const debtsToInsert = [
        {
            user_id: userId,
            type: 'CREDIT_CARD',
            creditor: 'Visa G&T Continental',
            balance: 18500.00,
            currency: 'GTQ',
            apr: 48.00, // Typical GT credit card rate
            min_payment: 925.00,
            statement_date: 20,
            due_date: 5,
            next_payment_date: nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Tarjeta principal de consumo',
        },
        {
            user_id: userId,
            type: 'CREDIT_CARD',
            creditor: 'Mastercard Banrural',
            balance: 7200.00,
            currency: 'GTQ',
            apr: 54.00, // Higher rate card
            min_payment: 360.00,
            statement_date: 15,
            due_date: 28,
            next_payment_date: nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Tarjeta de respaldo',
        },
        {
            user_id: userId,
            type: 'CREDIT_CARD',
            creditor: 'American Express BAC',
            balance: 3200.00,
            currency: 'USD',
            apr: 29.99,
            min_payment: 100.00,
            statement_date: 10,
            due_date: 25,
            next_payment_date: nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Para compras en dólares',
        },
        {
            user_id: userId,
            type: 'LOAN',
            creditor: 'Préstamo BAM',
            balance: 45000.00,
            currency: 'GTQ',
            apr: 18.50,
            min_payment: 1250.00,
            due_date: 1,
            next_payment_date: nextPaymentDate,
            installment_count: 48,
            installments_left: 32,
            fixed_payment: 1250.00,
            status: 'ACTIVE',
            notes: 'Préstamo personal consolidación',
        },
        {
            user_id: userId,
            type: 'INSTALLMENT',
            creditor: 'Elektra - Laptop',
            balance: 4800.00,
            currency: 'GTQ',
            apr: 36.00,
            min_payment: 400.00,
            due_date: 15,
            next_payment_date: nextPaymentDate,
            installment_count: 18,
            installments_left: 12,
            fixed_payment: 400.00,
            status: 'ACTIVE',
            notes: 'MacBook Air para trabajo',
        },
        {
            user_id: userId,
            type: 'INFORMAL',
            creditor: 'Préstamo Tío Mario',
            balance: 5000.00,
            currency: 'GTQ',
            apr: 0.00, // Sin interés
            min_payment: 500.00,
            due_date: 30,
            next_payment_date: nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Préstamo familiar sin interés',
        },
    ];

    const { data: debts, error: debtsError } = await supabase
        .from('debts')
        .insert(debtsToInsert.map((d) => ({ ...d, tenant_id: tenantId })))
        .select();

    if (debtsError) {
        throw new Error(`Error inserting debts: ${debtsError.message}`);
    }

    // ============================================
    // 2. INCOME EVENTS - Salario + Extras
    // ============================================
    const incomeToInsert = [
        {
            user_id: userId,
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`,
            amount: 12000.00,
            currency: 'GTQ',
            type: 'FIXED',
            notes: 'Salario quincena 1',
        },
        {
            user_id: userId,
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-30`,
            amount: 12000.00,
            currency: 'GTQ',
            type: 'FIXED',
            notes: 'Salario quincena 2',
        },
        {
            user_id: userId,
            date: today,
            amount: 3500.00,
            currency: 'GTQ',
            type: 'VARIABLE',
            notes: 'Freelance diseño web',
        },
    ];

    const { error: incomeError } = await supabase
        .from('income_events')
        .insert(incomeToInsert.map((d) => ({ ...d, tenant_id: tenantId })));

    if (incomeError) {
        throw new Error(`Error inserting income: ${incomeError.message}`);
    }

    // ============================================
    // 3. ESSENTIAL EXPENSES - Gastos fijos GT
    // ============================================
    const expensesToInsert = [
        {
            user_id: userId,
            name: 'Alquiler apartamento',
            amount: 4500.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Energía eléctrica EEGSA',
            amount: 450.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Agua municipal',
            amount: 120.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Internet Claro 100Mbps',
            amount: 350.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Plan celular Tigo',
            amount: 199.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Netflix + Spotify',
            amount: 180.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Seguro médico',
            amount: 650.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            user_id: userId,
            name: 'Gasolina vehículo',
            amount: 1200.00,
            frequency: 'MONTHLY',
            next_date: nextPaymentDate,
            currency: 'GTQ',
        },
    ];

    const { error: expensesError } = await supabase
        .from('essential_expenses')
        .insert(expensesToInsert.map((d) => ({ ...d, tenant_id: tenantId })));

    if (expensesError) {
        throw new Error(`Error inserting expenses: ${expensesError.message}`);
    }

    // ============================================
    // 4. VARIABLE BUDGET TARGETS
    // ============================================
    const budgetsToInsert = [
        {
            user_id: userId,
            category: 'Alimentación',
            amount: 3000.00,
            period: 'MONTHLY',
            currency: 'GTQ',
        },
        {
            user_id: userId,
            category: 'Entretenimiento',
            amount: 800.00,
            period: 'MONTHLY',
            currency: 'GTQ',
        },
        {
            user_id: userId,
            category: 'Transporte',
            amount: 500.00,
            period: 'MONTHLY',
            currency: 'GTQ',
        },
        {
            user_id: userId,
            category: 'Salud',
            amount: 400.00,
            period: 'MONTHLY',
            currency: 'GTQ',
        },
    ];

    const { error: budgetsError } = await supabase
        .from('variable_budget_targets')
        .insert(budgetsToInsert.map((d) => ({ ...d, tenant_id: tenantId })));

    if (budgetsError) {
        throw new Error(`Error inserting budgets: ${budgetsError.message}`);
    }

    // ============================================
    // 5. UPDATE USER PROFILE
    // ============================================
    const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: userId,
            currency_base: 'GTQ',
            pay_frequency: 'BIWEEKLY',
            pay_dates: [15, 30],
            goal_type: 'BALANCED',
            timezone: 'America/Guatemala',
            onboarding_completed: true,
        }, { onConflict: 'user_id' });

    if (profileError) {
        throw new Error(`Error updating profile: ${profileError.message}`);
    }

    // ============================================
    // 6. CREATE SUBSCRIPTION (Pro plan) - Skip if exists
    // ============================================
    const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('tenant_id', tenantId)
        .single();

    if (!existingSub) {
        const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                tenant_id: tenantId,
                user_id: userId,
                purchaser_user_id: userId,
                plan_code: 'PRO',
                status: 'ACTIVE',
                provider: 'manual',
                start_at: now.toISOString(),
            });

        if (subError) {
            console.warn(`Warning: Could not create subscription: ${subError.message}`);
            // Don't throw - subscription is not critical for testing
        }
    }

    return {
        success: true,
        data: {
            debtsCreated: debts?.length || 0,
            incomeCreated: incomeToInsert.length,
            expensesCreated: expensesToInsert.length,
            budgetsCreated: budgetsToInsert.length,
        },
    };
}

/**
 * Clear all test data for a user
 */
export async function clearTestData(userId: string) {
    await requirePermission('seed:run');
    const supabase = await createAdminClient();
    const tenantId = await ensureCurrentTenantForUser(userId);

    // First get plans for this user to delete their items
    const { data: plans } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', userId);

    // Delete plan items for user's plans
    if (plans && plans.length > 0) {
        const planIds = plans.map(p => p.id);
        await supabase.from('plan_items').delete().in('plan_id', planIds);
    }

    // Delete in order to respect foreign keys
    await supabase.from('plans').delete().eq('user_id', userId);
    await supabase.from('payments').delete().eq('user_id', userId);
    await supabase.from('debt_documents').delete().eq('user_id', userId);
    await supabase.from('debts').delete().eq('user_id', userId);
    await supabase.from('income_events').delete().eq('user_id', userId);
    await supabase.from('essential_expenses').delete().eq('user_id', userId);
    await supabase.from('variable_budget_targets').delete().eq('user_id', userId);
    await supabase.from('subscriptions').delete().eq('tenant_id', tenantId);

    return { success: true };
}
