'use server';

import { revalidatePath } from 'next/cache';
import { requireUserTenant } from '@/lib/tenant/server';
import { checkDebtLimit, checkFeatureAccess } from '@/lib/utils/feature-access';
import type { Debt } from '@/types';
import type { PaginationParams, PaginatedResponse } from '@/types/pagination';
import {
    sanitizePaginationParams,
    calculateOffset,
    buildPaginationMeta,
} from '@/types/pagination';
import {
    CACHE_TAGS,
    invalidateCacheByTag,
} from '@/lib/cache/next-cache';
import { invalidateInsightsCache } from '@/lib/insights';
import {
    createDebtSchema,
    updateDebtSchema,
} from '@/lib/validations/api';
import { recordMarketingEvent } from '@/lib/funnel/events';

// Types for debt operations
export interface CreateDebtInput {
    creditor: string;
    type: 'CREDIT_CARD' | 'LOAN' | 'INSTALLMENT' | 'INFORMAL';
    balance: number;
    min_payment: number;
    apr?: number;
    due_date: number;
    payment_day?: number;
    interest_model?: 'MONTHLY_SIMPLE' | 'DAILY_SIMPLE' | 'DAILY_AVG_BALANCE';
    monthly_fees?: number;
    min_payment_rule?: unknown;
    cut_date?: number;
    category?: string;
    goal_extra_payment?: number;
    goal_target_date?: string;
    currency?: 'GTQ' | 'USD';
    notes?: string;
    tags?: string[];
}

export interface UpdateDebtInput extends Partial<CreateDebtInput> {
    id: string;
}

// Fetch all debts for the current user (with pagination support)
export async function getDebts(
    status: 'ACTIVE' | 'PAID_OFF' | 'PAID' | 'all' = 'ACTIVE',
    pagination?: PaginationParams
): Promise<Debt[] | PaginatedResponse<Debt>> {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Determine if pagination is requested
    const usePagination = pagination !== undefined;

    // Sanitize pagination params
    const { page, limit, sortBy, sortOrder } = sanitizePaginationParams(pagination || {});

    let query = supabase
        .from('debts')
        .select('*', { count: usePagination ? 'exact' : undefined })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    // Filter by status
    // DB uses PAID_OFF. Keep 'PAID' as a backward-compatible alias at the API boundary.
    if (status !== 'all') {
        const dbStatus = status === 'PAID' ? 'PAID_OFF' : status;
        query = query.eq('status', dbStatus);
    }

    // Apply sorting
    const orderBy = sortBy || 'balance';
    const order = sortOrder || 'desc';
    query = query.order(orderBy, { ascending: order === 'asc' });

    // Apply pagination if requested
    if (usePagination) {
        const offset = calculateOffset(page, limit);
        query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching debts:', error);
        throw new Error('Error al cargar las deudas');
    }

    // Return paginated response if pagination was requested
    if (usePagination) {
        return {
            data: (data as Debt[]) || [],
            pagination: buildPaginationMeta(count || 0, page, limit),
        };
    }

    // Otherwise return simple array (backward compatible)
    return data as Debt[];
}

// Get a single debt by ID
export async function getDebtById(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    // PERF-011: Select specific fields instead of *
    const { data, error } = await supabase
        .from('debts')
        .select('id, user_id, type, creditor, balance, currency, apr, min_payment, statement_date, due_date, payment_day, interest_model, monthly_fees, min_payment_rule, next_payment_date, category, installment_count, installments_left, fixed_payment, goal_extra_payment, goal_target_date, status, notes, created_at, updated_at')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('Error fetching debt:', error);
        throw new Error('Error al cargar la deuda');
    }

    return data as Debt;
}

// Create a new debt
export async function createDebt(input: CreateDebtInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const { count: existingDebtCount } = await supabase
        .from('debts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const { hasAccess: canUseGoals } = await checkFeatureAccess('debtGoals');
    const goalExtraPayment = canUseGoals ? input.goal_extra_payment : undefined;
    const goalTargetDate = canUseGoals ? input.goal_target_date : undefined;

    // Validate input with Zod (VUL-006 remediation)
    const validated = createDebtSchema.parse({
        name: input.creditor,
        type: input.type,
        balance: input.balance,
        apr: input.apr ?? 0,
        minimum_payment: input.min_payment,
        due_day: input.due_date,
        payment_day: input.payment_day,
        interest_model: input.interest_model,
        monthly_fees: input.monthly_fees ?? 0,
        min_payment_rule: input.min_payment_rule,
        currency: input.currency ?? 'GTQ',
        category: input.category,
        creditor: input.creditor,
        notes: input.notes,
        tags: input.tags,
        goal_extra_payment: goalExtraPayment,
        goal_target_date: goalTargetDate,
        status: 'ACTIVE' as const,
    });

    // Check debt limit for FREE users
    const limitResult = await checkDebtLimit();
    if (!limitResult.canAdd) {
        // Use special error format: DEBT_LIMIT:current:max
        throw new Error(`DEBT_LIMIT:${limitResult.currentCount}:${limitResult.maxAllowed}`);
    }

    // Calculate next payment date based on due_date
    const today = new Date();
    const dueDay = validated.due_day;
    let nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

    // If due date has passed this month, move to next month
    if (nextPaymentDate <= today) {
        nextPaymentDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    }

    const { data, error } = await supabase
        .from('debts')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            creditor: validated.creditor || validated.name,
            type: validated.type,
            balance: validated.balance,
            min_payment: validated.minimum_payment,
            apr: validated.apr,
            due_date: validated.due_day,
            payment_day: validated.payment_day ?? validated.due_day,
            interest_model: validated.interest_model ?? (validated.type === 'CREDIT_CARD' ? 'DAILY_SIMPLE' : 'MONTHLY_SIMPLE'),
            monthly_fees: validated.monthly_fees ?? 0,
            min_payment_rule: validated.min_payment_rule ?? null,
            statement_date: input.cut_date,
            next_payment_date: nextPaymentDate.toISOString().split('T')[0],
            currency: validated.currency,
            category: validated.category ?? null,
            notes: validated.notes,
            tags: validated.tags ?? [],
            status: validated.status,
            goal_extra_payment: validated.goal_extra_payment ?? 0,
            goal_target_date: validated.goal_target_date ?? null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating debt:', error);
        throw new Error('Error al crear la deuda');
    }

    // Invalidate caches
    await invalidateCacheByTag(CACHE_TAGS.USER_DEBTS);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_PROJECTION);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_FORECAST);
    await invalidateInsightsCache(user.id);

    revalidatePath('/debts');
    revalidatePath('/dashboard');

    if ((existingDebtCount || 0) === 0) {
        await recordMarketingEvent({
            eventName: 'first_debt_added',
            tenantId,
            userId: user.id,
            path: '/debts',
        });
    }

    return data as Debt;
}

// Update an existing debt
export async function updateDebt(input: UpdateDebtInput) {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { id, ...updates } = input;

    const { hasAccess: canUseGoals } = await checkFeatureAccess('debtGoals');

    // Validate updates with Zod (VUL-006 remediation)
    // Transform to match schema field names
    const updateData: Record<string, unknown> = {};
    if (updates.creditor !== undefined) {
        updateData.name = updates.creditor;
        updateData.creditor = updates.creditor;
    }
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.balance !== undefined) updateData.balance = updates.balance;
    if (updates.apr !== undefined) updateData.apr = updates.apr;
    if (updates.min_payment !== undefined) updateData.minimum_payment = updates.min_payment;
    if (updates.due_date !== undefined) updateData.due_day = updates.due_date;
    if (updates.payment_day !== undefined) updateData.payment_day = updates.payment_day;
    if (updates.interest_model !== undefined) updateData.interest_model = updates.interest_model;
    if (updates.monthly_fees !== undefined) updateData.monthly_fees = updates.monthly_fees;
    if (updates.min_payment_rule !== undefined) updateData.min_payment_rule = updates.min_payment_rule;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (canUseGoals && updates.goal_extra_payment !== undefined) updateData.goal_extra_payment = updates.goal_extra_payment;
    if (canUseGoals && updates.goal_target_date !== undefined) updateData.goal_target_date = updates.goal_target_date;

    const validated = updateDebtSchema.parse(updateData);

    // Transform back to DB schema
    const dbUpdates: Record<string, unknown> = {};
    if (validated.name !== undefined) dbUpdates.creditor = validated.name;
    if (validated.type !== undefined) dbUpdates.type = validated.type;
    if (validated.balance !== undefined) dbUpdates.balance = validated.balance;
    if (validated.apr !== undefined) dbUpdates.apr = validated.apr;
    if (validated.minimum_payment !== undefined) dbUpdates.min_payment = validated.minimum_payment;
    if (validated.due_day !== undefined) dbUpdates.due_date = validated.due_day;
    if (validated.payment_day !== undefined) dbUpdates.payment_day = validated.payment_day;
    if (validated.interest_model !== undefined) dbUpdates.interest_model = validated.interest_model;
    if (validated.monthly_fees !== undefined) dbUpdates.monthly_fees = validated.monthly_fees;
    if (validated.min_payment_rule !== undefined) dbUpdates.min_payment_rule = validated.min_payment_rule;
    if (validated.currency !== undefined) dbUpdates.currency = validated.currency;
    if (validated.category !== undefined) dbUpdates.category = validated.category;
    if (validated.notes !== undefined) dbUpdates.notes = validated.notes;
    if (validated.tags !== undefined) dbUpdates.tags = validated.tags;
    if (updates.cut_date !== undefined) dbUpdates.statement_date = updates.cut_date;
    if (validated.goal_extra_payment !== undefined) dbUpdates.goal_extra_payment = validated.goal_extra_payment;
    if (validated.goal_target_date !== undefined) dbUpdates.goal_target_date = validated.goal_target_date;

    const { data, error } = await supabase
        .from('debts')
        .update(dbUpdates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating debt:', error);
        throw new Error('Error al actualizar la deuda');
    }

    // Invalidate caches
    await invalidateCacheByTag(CACHE_TAGS.USER_DEBTS);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_PROJECTION);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_FORECAST);
    await invalidateInsightsCache(user.id);

    revalidatePath('/debts');
    revalidatePath('/dashboard');

    return data as Debt;
}

// Delete a debt
export async function deleteDebt(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting debt:', error);
        throw new Error('Error al eliminar la deuda');
    }

    // Invalidate caches
    await invalidateCacheByTag(CACHE_TAGS.USER_DEBTS);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_PROJECTION);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_FORECAST);
    await invalidateInsightsCache(user.id);

    revalidatePath('/debts');
    revalidatePath('/dashboard');

    return { success: true };
}

// Mark a debt as paid
export async function markDebtAsPaid(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { data, error } = await supabase
        .from('debts')
        .update({
            status: 'PAID_OFF',
            balance: 0,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error marking debt as paid:', error);
        throw new Error('Error al marcar la deuda como pagada');
    }

    // Invalidate caches
    await invalidateCacheByTag(CACHE_TAGS.USER_DEBTS);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_PROJECTION);
    await invalidateCacheByTag(CACHE_TAGS.ENGINE_FORECAST);
    await invalidateInsightsCache(user.id);

    revalidatePath('/debts');
    revalidatePath('/dashboard');

    return data as Debt;
}

// Get debt statistics
export async function getDebtStats() {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { data: debts, error } = await supabase
        .from('debts')
        .select('balance, min_payment, apr')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    if (error) {
        console.error('Error fetching debt stats:', error);
        throw new Error('Error al cargar estadísticas');
    }

    const totalBalance = debts?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;
    const totalMinPayment = debts?.reduce((sum, d) => sum + Number(d.min_payment), 0) || 0;
    const averageApr = debts?.length
        ? debts.reduce((sum, d) => sum + Number(d.apr), 0) / debts.length
        : 0;
    const debtCount = debts?.length || 0;

    return {
        totalBalance,
        totalMinPayment,
        averageApr,
        debtCount,
    };
}
