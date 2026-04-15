'use server';

import { createAdminClient } from '@/lib/supabase/server';
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
    // This is used by cron, so we must bypass RLS to scan all users' debts.
    const supabase = createAdminClient();

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('debts')
        .select('id, creditor, min_payment, currency, next_payment_date, due_date, user_id')
        .eq('status', 'ACTIVE')
        .gte('next_payment_date', todayStr)
        .lte('next_payment_date', futureDateStr)
        .order('next_payment_date', { ascending: true });

    if (error) {
        console.error('Error fetching upcoming payments:', error);
        return [];
    }

    return data || [];
}

/**
 * Group debts by user and get user email (requires service role)
 */
export async function groupDebtsByUser(debts: UpcomingDebt[]): Promise<UserWithDebts[]> {
    if (debts.length === 0) return [];

    // This function requires service role for admin.listUsers()
    // In production, you'd use a service role client
    // For now, we'll create user groups without fetching emails
    // The cron job should use service role to access user emails

    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Missing Supabase credentials for email reminders');
        return [];
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // Group by user_id
    const debtsByUser = new Map<string, UpcomingDebt[]>();
    debts.forEach(debt => {
        const existing = debtsByUser.get(debt.user_id) || [];
        existing.push(debt);
        debtsByUser.set(debt.user_id, existing);
    });

    const result: UserWithDebts[] = [];

    for (const [userId, userDebts] of debtsByUser) {
        // Get user from auth
        const { data: authData, error } = await supabase.auth.admin.getUserById(userId);

        if (error || !authData?.user?.email) {
            console.log(`Could not get email for user ${userId}`);
            continue;
        }

        const today = new Date();

        result.push({
            userId,
            email: authData.user.email,
            displayName: authData.user.user_metadata?.name,
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
