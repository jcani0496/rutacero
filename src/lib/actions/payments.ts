'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, count, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
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
import { isDrizzleEnabled } from '@/lib/data/provider';
import { mapPaymentRow } from '@/lib/data/mappers';
import { getDb } from '@/db/client';
import { createPaymentAtomic } from '@/db/payments-atomic';
import { debts, payments } from '@/db/schema';
import { resolveUserWorkingCurrencyForWrite } from '@/lib/currency/working-currency-server';

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

const PAYMENT_SORT_COLUMNS = {
    payment_date: payments.paymentDate,
    amount: payments.amount,
    created_at: payments.createdAt,
    method: payments.method,
} as const;

function paymentOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc'): SQL {
    const column =
        (sortBy && sortBy in PAYMENT_SORT_COLUMNS
            ? PAYMENT_SORT_COLUMNS[sortBy as keyof typeof PAYMENT_SORT_COLUMNS]
            : payments.paymentDate) ?? payments.paymentDate;
    return (sortOrder || 'desc') === 'asc' ? asc(column) : desc(column);
}

function historyLimitDate(historyMonths: number): string {
    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() - historyMonths);
    return limitDate.toISOString().split('T')[0]!;
}

/** Zod datetime → YYYY-MM-DD for createPaymentAtomic. */
function toPaymentDateOnly(isoDatetime: string): string {
    return isoDatetime.slice(0, 10);
}

async function invalidatePaymentCaches(tenantId: string, userId: string) {
    await invalidateInsightsCache(tenantId, userId);
    await invalidateMovimientosCache(tenantId, userId);
    revalidatePath('/payments');
    revalidatePath('/debts');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');
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

    if (isDrizzleEnabled()) {
        const db = getDb();
        const conditions = [
            eq(payments.tenantId, tenantId),
            eq(payments.userId, user.id),
        ];
        if (!isPro && historyMonths !== Infinity) {
            conditions.push(gte(payments.paymentDate, historyLimitDate(historyMonths)));
        }
        if (debtId) {
            conditions.push(eq(payments.debtId, debtId));
        }
        const where = and(...conditions);

        const selectShape = {
            id: payments.id,
            userId: payments.userId,
            debtId: payments.debtId,
            amount: payments.amount,
            currency: payments.currency,
            paymentDate: payments.paymentDate,
            method: payments.method,
            createdAt: payments.createdAt,
            receiptUrl: payments.receiptUrl,
            receiptUploadedAt: payments.receiptUploadedAt,
            debtCreditor: debts.creditor,
            debtType: debts.type,
        };

        const mapRow = (row: {
            id: string;
            userId: string;
            debtId: string;
            amount: string;
            currency: string;
            paymentDate: string;
            method: string | null;
            createdAt: Date;
            receiptUrl: string | null;
            receiptUploadedAt: Date | null;
            debtCreditor: string;
            debtType: string;
        }): PaymentWithDebt => ({
            ...mapPaymentRow(row),
            debt: {
                creditor: row.debtCreditor,
                type: row.debtType,
            },
        });

        if (usePagination) {
            const offset = calculateOffset(page, limit);
            const [rows, [totalRow]] = await Promise.all([
                db
                    .select(selectShape)
                    .from(payments)
                    .innerJoin(debts, eq(payments.debtId, debts.id))
                    .where(where)
                    .orderBy(paymentOrderBy(sortBy, sortOrder))
                    .limit(limit)
                    .offset(offset),
                db.select({ value: count() }).from(payments).where(where),
            ]);
            return {
                data: rows.map(mapRow),
                pagination: buildPaginationMeta(totalRow?.value ?? 0, page, limit),
            };
        }

        const rows = await db
            .select(selectShape)
            .from(payments)
            .innerJoin(debts, eq(payments.debtId, debts.id))
            .where(where)
            .orderBy(paymentOrderBy(sortBy, sortOrder));
        return rows.map(mapRow);
    }

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
        query = query.gte('payment_date', historyLimitDate(historyMonths));
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

    const { data, error, count: rowCount } = await query;

    if (error) {
        console.error('Error fetching payments:', error);
        throw new Error('Error al cargar los pagos');
    }

    // Return paginated response if pagination was requested
    if (usePagination) {
        return {
            data: (data as PaymentWithDebt[]) || [],
            pagination: buildPaginationMeta(rowCount || 0, page, limit),
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

    if (isDrizzleEnabled()) {
        const db = getDb();
        const scope = and(
            eq(payments.tenantId, tenantId),
            eq(payments.userId, user.id),
        );
        const [totalRow] = await db.select({ value: count() }).from(payments).where(scope);
        const total = totalRow?.value ?? 0;

        if (isPro || historyMonths === Infinity) {
            return { total, visible: total, hidden: 0, isPro };
        }

        const [visibleRow] = await db
            .select({ value: count() })
            .from(payments)
            .where(
                and(
                    scope,
                    gte(payments.paymentDate, historyLimitDate(historyMonths)),
                ),
            );
        const visible = visibleRow?.value ?? 0;
        return { total, visible, hidden: total - visible, isPro };
    }

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

    const { count: visibleCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gte('payment_date', historyLimitDate(historyMonths));

    const visible = visibleCount || 0;
    const hidden = total - visible;

    return { total, visible, hidden, isPro };
}

// Create a new payment and update debt balance
export async function createPayment(input: CreatePaymentInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    // Validate input with Zod (VUL-006 remediation)
    const validated = createPaymentSchema.parse({
        debt_id: input.debt_id,
        amount: input.amount,
        payment_date: new Date(input.payment_date).toISOString(),
        payment_method: input.method,
        notes: undefined, // Not in current input interface
        is_extra: false,
    });

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const result = await createPaymentAtomic(db, {
                userId: user.id,
                debtId: validated.debt_id,
                amount: validated.amount,
                currency: workingCurrency,
                paymentDate: toPaymentDateOnly(validated.payment_date),
                paymentMethod: validated.payment_method,
            });

            const [payment] = await db
                .select()
                .from(payments)
                .where(
                    and(
                        eq(payments.id, result.paymentId),
                        eq(payments.tenantId, tenantId),
                    ),
                )
                .limit(1);

            await invalidatePaymentCaches(tenantId, user.id);

            if (!payment) {
                throw new Error('Error al registrar el pago');
            }
            return mapPaymentRow(payment);
        } catch (error) {
            console.error('Error creating payment atomically:', error);
            throw new Error('Error al registrar el pago');
        }
    }

    // Use atomic RPC function (VUL-008 remediation)
    // This prevents inconsistent state between payments and debts tables
    const { data, error } = await supabase.rpc('create_payment_atomic', {
        p_debt_id: validated.debt_id,
        p_amount: validated.amount,
        p_currency: workingCurrency,
        p_payment_date: validated.payment_date,
        p_payment_method: validated.payment_method,
    });

    if (error) {
        console.error('Error creating payment atomically:', error);
        throw new Error('Error al registrar el pago');
    }

    // Extract result from RPC function
    const result = Array.isArray(data) ? data[0] : data;

    await invalidatePaymentCaches(tenantId, user.id);

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

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            await db.transaction(async (tx) => {
                const [payment] = await tx
                    .select({
                        amount: payments.amount,
                        debtId: payments.debtId,
                    })
                    .from(payments)
                    .where(
                        and(
                            eq(payments.id, id),
                            eq(payments.tenantId, tenantId),
                            eq(payments.userId, user.id),
                        ),
                    )
                    .for('update');

                if (!payment) {
                    throw new Error('Pago no encontrado');
                }

                const [debt] = await tx
                    .select({ balance: debts.balance })
                    .from(debts)
                    .where(
                        and(
                            eq(debts.id, payment.debtId),
                            eq(debts.tenantId, tenantId),
                        ),
                    )
                    .for('update');

                await tx
                    .delete(payments)
                    .where(
                        and(
                            eq(payments.id, id),
                            eq(payments.tenantId, tenantId),
                            eq(payments.userId, user.id),
                        ),
                    );

                if (debt) {
                    const restoredBalance =
                        Number(debt.balance) + Number(payment.amount);
                    await tx
                        .update(debts)
                        .set({
                            balance: String(restoredBalance),
                            status: 'ACTIVE',
                            updatedAt: sql`now()`,
                        })
                        .where(
                            and(
                                eq(debts.id, payment.debtId),
                                eq(debts.tenantId, tenantId),
                            ),
                        );
                }
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'Pago no encontrado') {
                throw error;
            }
            console.error('Error deleting payment:', error);
            throw new Error('Error al eliminar el pago');
        }

        await invalidatePaymentCaches(tenantId, user.id);
        return { success: true };
    }

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

    await invalidatePaymentCaches(tenantId, user.id);
    return { success: true };
}

// Get payment statistics
export async function getPaymentStats() {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select({
                amount: payments.amount,
                paymentDate: payments.paymentDate,
            })
            .from(payments)
            .where(
                and(
                    eq(payments.tenantId, tenantId),
                    eq(payments.userId, user.id),
                ),
            )
            .orderBy(desc(payments.paymentDate));

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const thisMonthPayments = rows.filter((p) => {
            const date = new Date(p.paymentDate);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const ytdPayments = rows.filter((p) => {
            const date = new Date(p.paymentDate);
            return date.getFullYear() === currentYear;
        });

        const lastPayment = rows[0];

        return {
            totalThisMonth: thisMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            totalYTD: ytdPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            lastPaymentDate: lastPayment?.paymentDate || null,
            lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : 0,
            paymentCount: rows.length,
        };
    }

    // Get all payments
    const { data: paymentRows, error } = await supabase
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
    const thisMonthPayments = paymentRows?.filter(p => {
        const date = new Date(p.payment_date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }) || [];

    const ytdPayments = paymentRows?.filter(p => {
        const date = new Date(p.payment_date);
        return date.getFullYear() === currentYear;
    }) || [];

    const totalThisMonth = thisMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalYTD = ytdPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const lastPayment = paymentRows?.[0];
    const paymentCount = paymentRows?.length || 0;

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

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select({
                id: debts.id,
                creditor: debts.creditor,
                balance: debts.balance,
                currency: debts.currency,
                type: debts.type,
                minPayment: debts.minPayment,
            })
            .from(debts)
            .where(
                and(
                    eq(debts.tenantId, tenantId),
                    eq(debts.userId, user.id),
                    eq(debts.status, 'ACTIVE'),
                ),
            )
            .orderBy(desc(debts.balance));

        return rows.map((row) => ({
            id: row.id,
            creditor: row.creditor,
            balance: Number(row.balance),
            currency: row.currency as Currency,
            type: row.type as Debt['type'],
            min_payment: Number(row.minPayment),
        }));
    }

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
