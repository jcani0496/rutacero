import { sendEmail } from '@/lib/resend/client';
import { AccountDeletionConfirmation } from '@/lib/emails/account-deletion-confirmation';

interface SendArgs {
    to: string;
    executesAt: Date;
    gracePeriodDays: number;
}

/**
 * Sends the account-deletion confirmation email via the shared Resend client.
 *
 * Best-effort: callers should swallow non-permanent failures; the underlying
 * deletion request remains valid even if the email fails.
 */
export async function sendAccountDeletionConfirmation({
    to,
    executesAt,
    gracePeriodDays,
}: SendArgs) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rutacero.com';
    const cancelUrl = `${appUrl}/settings/delete-account`;

    await sendEmail({
        to,
        subject: 'Confirmamos tu solicitud de eliminacion de cuenta',
        react: AccountDeletionConfirmation({
            executesAt,
            gracePeriodDays,
            cancelUrl,
        }),
    });
}
