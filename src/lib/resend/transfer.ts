import { sendEmail } from '@/lib/resend/client';
import TransferInstructions, { type BankAccount } from '@/lib/emails/transfer-instructions';
import type { ProVariant } from '@/lib/billing/plans';
import { logger } from '@/lib/logger';

interface SendArgs {
    to: string;
    variant: ProVariant;
    referenceCode: string;
}

/**
 * Reads BANK_TRANSFER_INSTRUCTIONS_JSON from env and returns a list of valid
 * bank accounts. Returns [] (and logs) on missing/invalid JSON or invalid shape.
 */
export function getBankAccounts(): BankAccount[] {
    const raw = process.env.BANK_TRANSFER_INSTRUCTIONS_JSON;
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((a): a is BankAccount => {
            if (typeof a !== 'object' || a === null) return false;
            const obj = a as Record<string, unknown>;
            return (
                typeof obj.bank === 'string' &&
                typeof obj.accountType === 'string' &&
                typeof obj.accountNumber === 'string' &&
                typeof obj.accountName === 'string'
            );
        });
    } catch (e) {
        logger.error({ err: e instanceof Error ? e.message : String(e) }, 'Invalid BANK_TRANSFER_INSTRUCTIONS_JSON');
        return [];
    }
}

/**
 * Sends manual-transfer instructions email via the shared Resend client
 * (with built-in retry logic from `sendEmail`).
 */
export async function sendTransferInstructionsEmail({ to, variant, referenceCode }: SendArgs) {
    const accounts = getBankAccounts();
    if (accounts.length === 0) {
        throw new Error('BANK_TRANSFER_INSTRUCTIONS_JSON has no valid accounts configured.');
    }

    const fromAddress = process.env.RESEND_FROM_ADDRESS;

    await sendEmail({
        to,
        from: fromAddress,
        subject: `Instrucciones de pago — ${variant.label}`,
        react: TransferInstructions({
            variantLabel: variant.label,
            priceQ: variant.priceQ,
            accounts,
            referenceCode,
        }),
    });
}
