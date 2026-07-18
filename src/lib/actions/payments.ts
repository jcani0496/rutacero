'use server';

import { revalidatePath } from 'next/cache';
import { requireUserTenant } from '@/lib/tenant/server';
import { getUserPlan } from '@/lib/utils/feature-access';
import type { Payment, Currency, Debt } from '@/types';
import type { PaginationParams, PaginatedResponse } from '@/types/pagination';
import {
    sanitizePaginationParams,
    calculateOffset,
    buildPaginationMeta,
} from '@/types/pagination';
import { createPaymentSchema } from '@/lib/validations/api';
import { invalidateInsightsCache } from '@/lib/insights';
import { invalidateMovimientosCache } from '@/lib/movimientos/server';

// ============================================
// PAYMENT TYPES
// ============================================

export interface CreatePaymentInput {
    debt_id: string;
    amount: number;
    payment_date: string;
    method?: string;
    currency?: Currency;
}

export interface PaymentWithDebt extends Payment {
    debt?: {
        creditor: string;
        type: string;
    };
}

// ============================================
// PAYMENT ACTIONS
// ============================================

// Fetch all payments for the current user (with plan-based limit and pagination)
export async function getPayments(
    debtId?: string,
    pagination?: PaginationParams
): Promise<PaymentWithDebt[] | PaginatedResponse<PaymentWithDebt>> {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Get user plan to determine history limit
    const { limits, isPro } = await getUserPlan();
    const historyMonths = limits.maxPaymentsHistory;

    // Determine if pagination is requested
    const usePagination = pagination !== undefined;

    // Sanitize pagination params
    const { page, limit, sortBy, sortOrder } = sanitizePaginationParams(pagination || {});

    let query = supabase
        .from('payments')
        .select(
            `
            *,
            debt:debts!inner(creditor, type)
        `,
            { count: usePagination ? 'exact' : undefined }
        )
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    // Apply date limit for non-PRO users
    if (!isPro && historyMonths !== Infinity) {
        const limitDate = new Date();
        limitDate.setMonth(limitDate.getMonth() - historyMonths);
        query = query.gte('payment_date', limitDate.toISOString().split('T')[0]);
    }

    // Filter by debt if provided
    if (debtId) {
        query = query.eq('debt_id', debtId);
    }

    // Apply sorting
    const orderBy = sortBy || 'payment_date';
    const order = sortOrder || 'desc';
    query = query.order(orderBy, { ascending: order === 'asc' });

    // Apply pagination if requested
    if (usePagination) {
        const offset = calculateOffset(page, limit);
        query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching payments:', error);
        throw new Error('Error al cargar los pagos');
    }

    // Return paginated response if pagination was requested
    if (usePagination) {
        return {
            data: (data as PaymentWithDebt[]) || [],
            pagination: buildPaginationMeta(count || 0, page, limit),
        };
    }

    // Otherwise return simple array (backward compatible)
    return data as PaymentWithDebt[];
}

// Get total payment count (for showing "X more with PRO" message)
export async function getTotalPaymentCount(): Promise<{ total: number; visible: number; hidden: number; isPro: boolean }> {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { limits, isPro } = await getUserPlan();
    const historyMonths = limits.maxPaymentsHistory;

    // Get total count
    const { count: totalCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const total = totalCount || 0;

    // Get visible count (within limit)
    if (isPro || historyMonths === Infinity) {
        return { total, visible: total, hidden: 0, isPro };
    }

    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() - historyMonths);

    const { count: visibleCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gte('payment_date', limitDate.toISOString().split('T')[0]);

    const visible = visibleCount || 0;
    const hidden = total - visible;

    return { total, visible, hidden, isPro };
}

// Create a new payment and update debt balance
export async function createPayment(input: CreatePaymentInput) {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Validate input with Zod (VUL-006 remediation)
    const validated = createPaymentSchema.parse({
        debt_id: input.debt_id,
        amount: input.amount,
        payment_date: new Date(input.payment_date).toISOString(),
        payment_method: input.method,
        notes: undefined, // Not in current input interface
        is_extra: false,
    });

    // Use atomic RPC function (VUL-008 remediation)
    // This prevents inconsistent state between payments and debts tables
    const { data, error } = await supabase.rpc('create_payment_atomic', {
        p_debt_id: validated.debt_id,
        p_amount: validated.amount,
        p_currency: input.currency ?? 'GTQ',
        p_payment_date: validated.payment_date,
        p_payment_method: validated.payment_method,
    });

    if (error) {
        console.error('Error creating payment atomically:', error);
        throw new Error('Error al registrar el pago');
    }

    // Extract result from RPC function
    const result = Array.isArray(data) ? data[0] : data;

    await invalidateInsightsCache(tenantId, user.id);
    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/payments');
    revalidatePath('/debts');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    // Return payment object (fetch it to get full details)
    // PERF-011: Select specific fields instead of *
    const { data: payment } = await supabase
        .from('payments')
        .select('id, user_id, debt_id, amount, currency, payment_date, method, created_at')
        .eq('id', result.payment_id)
        .eq('tenant_id', tenantId)
        .single();

    return payment as Payment;
}

// Delete a payment and restore debt balance
export async function deletePayment(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Get payment to restore balance
    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('amount, debt_id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .single();

    if (paymentError || !payment) {
        console.error('Error fetching payment:', paymentError);
        throw new Error('Pago no encontrado');
    }

    // Delete payment
    const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (deleteError) {
        console.error('Error deleting payment:', deleteError);
        throw new Error('Error al eliminar el pago');
    }

    // Restore debt balance
    const { data: debt } = await supabase
        .from('debts')
        .select('balance')
        .eq('id', payment.debt_id)
        .eq('tenant_id', tenantId)
        .single();

    if (debt) {
        const restoredBalance = Number(debt.balance) + Number(payment.amount);
        await supabase
            .from('debts')
            .update({
                balance: restoredBalance,
                status: 'ACTIVE',
            })
            .eq('id', payment.debt_id);
    }

    await invalidateInsightsCache(tenantId, user.id);
    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/payments');
    revalidatePath('/debts');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return { success: true };
}

// Get payment statistics
export async function getPaymentStats() {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Get all payments
    const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false });

    if (error) {
        console.error('Error fetching payment stats:', error);
        throw new Error('Error al cargar estadísticas');
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate stats
    const thisMonthPayments = payments?.filter(p => {
        const date = new Date(p.payment_date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }) || [];

    const ytdPayments = payments?.filter(p => {
        const date = new Date(p.payment_date);
        return date.getFullYear() === currentYear;
    }) || [];

    const totalThisMonth = thisMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalYTD = ytdPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const lastPayment = payments?.[0];
    const paymentCount = payments?.length || 0;

    return {
        totalThisMonth,
        totalYTD,
        lastPaymentDate: lastPayment?.payment_date || null,
        lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : 0,
        paymentCount,
    };
}

// Get debts for payment selection dropdown
export async function getDebtsForPayment() {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { data, error } = await supabase
        .from('debts')
        .select('id, creditor, balance, currency, type, min_payment')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('balance', { ascending: false });

    if (error) {
        console.error('Error fetching debts:', error);
        throw new Error('Error al cargar deudas');
    }

    return data as Pick<Debt, 'id' | 'creditor' | 'balance' | 'currency' | 'type' | 'min_payment'>[];
}
