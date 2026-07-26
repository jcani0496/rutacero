'use server';

import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { requirePermission } from '@/lib/actions/admin-auth';
import { ensureCurrentTenantForUser } from '@/lib/tenant/server';

/**
 * Seed test data for a specific user
 * Uses realistic Guatemalan financial scenarios
 */
export async function seedTestData(userId: string) {
    await requirePermission('seed:run');
    const db = getDb();
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
            userId,
            type: 'CREDIT_CARD',
            creditor: 'Visa G&T Continental',
            balance: '18500.00',
            currency: 'GTQ',
            apr: '48.00', // Typical GT credit card rate
            minPayment: '925.00',
            statementDate: 20,
            dueDate: 5,
            nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Tarjeta principal de consumo',
        },
        {
            userId,
            type: 'CREDIT_CARD',
            creditor: 'Mastercard Banrural',
            balance: '7200.00',
            currency: 'GTQ',
            apr: '54.00', // Higher rate card
            minPayment: '360.00',
            statementDate: 15,
            dueDate: 28,
            nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Tarjeta de respaldo',
        },
        {
            userId,
            type: 'CREDIT_CARD',
            creditor: 'American Express BAC',
            balance: '3200.00',
            currency: 'USD',
            apr: '29.99',
            minPayment: '100.00',
            statementDate: 10,
            dueDate: 25,
            nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Para compras en dólares',
        },
        {
            userId,
            type: 'LOAN',
            creditor: 'Préstamo BAM',
            balance: '45000.00',
            currency: 'GTQ',
            apr: '18.50',
            minPayment: '1250.00',
            dueDate: 1,
            nextPaymentDate,
            installmentCount: 48,
            installmentsLeft: 32,
            fixedPayment: '1250.00',
            status: 'ACTIVE',
            notes: 'Préstamo personal consolidación',
        },
        {
            userId,
            type: 'INSTALLMENT',
            creditor: 'Elektra - Laptop',
            balance: '4800.00',
            currency: 'GTQ',
            apr: '36.00',
            minPayment: '400.00',
            dueDate: 15,
            nextPaymentDate,
            installmentCount: 18,
            installmentsLeft: 12,
            fixedPayment: '400.00',
            status: 'ACTIVE',
            notes: 'MacBook Air para trabajo',
        },
        {
            userId,
            type: 'INFORMAL',
            creditor: 'Préstamo Tío Mario',
            balance: '5000.00',
            currency: 'GTQ',
            apr: '0.00', // Sin interés
            minPayment: '500.00',
            dueDate: 30,
            nextPaymentDate,
            status: 'ACTIVE',
            notes: 'Préstamo familiar sin interés',
        },
    ];

    const debts = await db
        .insert(schema.debts)
        .values(debtsToInsert.map((d) => ({ ...d, tenantId })))
        .returning({ id: schema.debts.id });

    // ============================================
    // 2. INCOME EVENTS - Salario + Extras
    // ============================================
    const incomeToInsert = [
        {
            userId,
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`,
            amount: '12000.00',
            currency: 'GTQ',
            type: 'FIXED',
            notes: 'Salario quincena 1',
        },
        {
            userId,
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-30`,
            amount: '12000.00',
            currency: 'GTQ',
            type: 'FIXED',
            notes: 'Salario quincena 2',
        },
        {
            userId,
            date: today,
            amount: '3500.00',
            currency: 'GTQ',
            type: 'VARIABLE',
            notes: 'Freelance diseño web',
        },
    ];

    await db
        .insert(schema.incomeEvents)
        .values(incomeToInsert.map((d) => ({ ...d, tenantId })));

    // ============================================
    // 3. ESSENTIAL EXPENSES - Gastos fijos GT
    // ============================================
    const expensesToInsert = [
        {
            userId,
            name: 'Alquiler apartamento',
            amount: '4500.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Energía eléctrica EEGSA',
            amount: '450.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Agua municipal',
            amount: '120.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Internet Claro 100Mbps',
            amount: '350.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Plan celular Tigo',
            amount: '199.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Netflix + Spotify',
            amount: '180.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Seguro médico',
            amount: '650.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
        {
            userId,
            name: 'Gasolina vehículo',
            amount: '1200.00',
            frequency: 'MONTHLY',
            nextDate: nextPaymentDate,
            currency: 'GTQ',
        },
    ];

    await db
        .insert(schema.essentialExpenses)
        .values(expensesToInsert.map((d) => ({ ...d, tenantId })));

    // ============================================
    // 4. VARIABLE BUDGET TARGETS
    // ============================================
    const budgetsToInsert = [
        {
            userId,
            category: 'Alimentación',
            amount: '3000.00',
            period: 'MONTHLY',
            currency: 'GTQ',
        },
        {
            userId,
            category: 'Entretenimiento',
            amount: '800.00',
            period: 'MONTHLY',
            currency: 'GTQ',
        },
        {
            userId,
            category: 'Transporte',
            amount: '500.00',
            period: 'MONTHLY',
            currency: 'GTQ',
        },
        {
            userId,
            category: 'Salud',
            amount: '400.00',
            period: 'MONTHLY',
            currency: 'GTQ',
        },
    ];

    await db
        .insert(schema.variableBudgetTargets)
        .values(budgetsToInsert.map((d) => ({ ...d, tenantId })));

    // ============================================
    // 5. UPDATE USER PROFILE
    // ============================================
    const profileValues = {
        currencyBase: 'GTQ',
        payFrequency: 'BIWEEKLY',
        payDates: [15, 30],
        goalType: 'BALANCED',
        timezone: 'America/Guatemala',
        onboardingCompleted: true,
    };

    await db
        .insert(schema.userProfiles)
        .values({ userId, ...profileValues })
        .onConflictDoUpdate({
            target: schema.userProfiles.userId,
            set: { ...profileValues, updatedAt: new Date() },
        });

    // ============================================
    // 6. CREATE SUBSCRIPTION (Pro plan) - Skip if exists
    // ============================================
    const [existingSub] = await db
        .select({ id: schema.subscriptions.id })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.tenantId, tenantId))
        .limit(1);

    if (!existingSub) {
        try {
            await db.insert(schema.subscriptions).values({
                tenantId,
                userId,
                purchaserUserId: userId,
                planCode: 'PRO',
                status: 'ACTIVE',
                provider: 'manual',
                startAt: now,
            });
        } catch (subError) {
            // Don't throw - subscription is not critical for testing
            console.warn(
                `Warning: Could not create subscription: ${subError instanceof Error ? subError.message : String(subError)}`,
            );
        }
    }

    return {
        success: true,
        data: {
            debtsCreated: debts.length,
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
    const db = getDb();
    const tenantId = await ensureCurrentTenantForUser(userId);

    // First get plans for this user to delete their items
    const plans = await db
        .select({ id: schema.plans.id })
        .from(schema.plans)
        .where(eq(schema.plans.userId, userId));

    // Delete plan items for user's plans
    if (plans.length > 0) {
        const planIds = plans.map(p => p.id);
        await db.delete(schema.planItems).where(inArray(schema.planItems.planId, planIds));
    }

    // Delete in order to respect foreign keys
    await db.delete(schema.plans).where(eq(schema.plans.userId, userId));
    await db.delete(schema.payments).where(eq(schema.payments.userId, userId));
    await db.delete(schema.debtDocuments).where(eq(schema.debtDocuments.userId, userId));
    await db.delete(schema.debts).where(eq(schema.debts.userId, userId));
    await db.delete(schema.incomeEvents).where(eq(schema.incomeEvents.userId, userId));
    await db.delete(schema.essentialExpenses).where(eq(schema.essentialExpenses.userId, userId));
    await db.delete(schema.variableBudgetTargets).where(eq(schema.variableBudgetTargets.userId, userId));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.tenantId, tenantId));

    return { success: true };
}
