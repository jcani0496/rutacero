'use server';

import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { debts as debtsTable } from '@/db/schema';
import { sendEmail } from '@/lib/resend/client';
import { PaymentReminderEmail } from '@/lib/emails/payment-reminder';

interface UpcomingDebt {
    id: string;
    creditor: string;
    min_payment: number;
    currency: string;
    next_payment_date: string;
    due_date: number | null;
    user_id: string;
}

interface UserWithDebts {
    userId: string;
    email: string;
    displayName?: string;
    debts: Array<{
        creditor: string;
        amount: number;
        currency: string;
        dueDate: string;
        daysUntilDue: number;
    }>;
}

/**
 * Get debts with payments due within the next N days
 */
export async function getUpcomingPayments(daysAhead: number = 3): Promise<UpcomingDebt[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    try {
        // This is used by cron, so it scans every tenant's debts.
        const rows = await getDb()
            .select({
                id: debtsTable.id,
                creditor: debtsTable.creditor,
                minPayment: debtsTable.minPayment,
                currency: debtsTable.currency,
                nextPaymentDate: debtsTable.nextPaymentDate,
                dueDate: debtsTable.dueDate,
                userId: debtsTable.userId,
            })
            .from(debtsTable)
            .where(
                and(
                    eq(debtsTable.status, 'ACTIVE'),
                    gte(debtsTable.nextPaymentDate, todayStr),
                    lte(debtsTable.nextPaymentDate, futureDateStr),
                ),
            )
            .orderBy(asc(debtsTable.nextPaymentDate));

        return rows.map((row) => ({
            id: row.id,
            creditor: row.creditor,
            min_payment: Number(row.minPayment || 0),
            currency: row.currency,
            next_payment_date: row.nextPaymentDate,
            due_date: row.dueDate,
            user_id: row.userId,
        }));
    } catch (error) {
        console.error('Error fetching upcoming payments:', error);
        return [];
    }
}

/**
 * Group debts by user and get user email (requires service role)
 */
export async function groupDebtsByUser(debts: UpcomingDebt[]): Promise<UserWithDebts[]> {
    if (debts.length === 0) return [];

    // Resolve emails via identity adapter (better-auth / drizzle users table).
    const debtsByUser = new Map<string, UpcomingDebt[]>();
    debts.forEach(debt => {
        const existing = debtsByUser.get(debt.user_id) || [];
        existing.push(debt);
        debtsByUser.set(debt.user_id, existing);
    });

    const result: UserWithDebts[] = [];

    for (const [userId, userDebts] of debtsByUser) {
        const { getIdentityUserById } = await import('@/lib/auth/identity');
        const identityUser = await getIdentityUserById(userId);

        if (!identityUser?.email) {
            console.log(`Could not get email for user ${userId}`);
            continue;
        }

        const today = new Date();

        result.push({
            userId,
            email: identityUser.email,
            displayName: identityUser.name ?? undefined,
            debts: userDebts.map(debt => {
                const dueDate = new Date(debt.next_payment_date);
                const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                return {
                    creditor: debt.creditor,
                    amount: Number(debt.min_payment),
                    currency: debt.currency,
                    dueDate: debt.next_payment_date,
                    daysUntilDue: Math.max(0, daysUntilDue),
                };
            }),
        });
    }

    return result;
}

/**
 * Send payment reminder email to a user
 */
export async function sendPaymentReminder(user: UserWithDebts): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rutacero.com';

    try {
        await sendEmail({
            to: user.email,
            subject: user.debts.length === 1
                ? `Recordatorio: Tu pago de ${user.debts[0].creditor} vence pronto`
                : `Recordatorio: ${user.debts.length} pagos próximos`,
            react: PaymentReminderEmail({
                userName: user.displayName,
                debts: user.debts,
                dashboardUrl: appUrl,
            }),
        });

        console.log(`Payment reminder sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error(`Error sending reminder to ${user.email}:`, error);
        return false;
    }
}

/**
 * Process all upcoming payment reminders
 */
export async function processPaymentReminders(): Promise<{
    processed: number;
    sent: number;
    errors: number;
}> {
    const debts = await getUpcomingPayments(3);
    const usersWithDebts = await groupDebtsByUser(debts);

    let sent = 0;
    let errors = 0;

    for (const user of usersWithDebts) {
        const success = await sendPaymentReminder(user);
        if (success) {
            sent++;
        } else {
            errors++;
        }
    }

    return {
        processed: usersWithDebts.length,
        sent,
        errors,
    };
}
