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
 * Thrown when BANK_TRANSFER_INSTRUCTIONS_JSON is missing or yields zero valid
 * accounts. Distinguishes a server-side misconfiguration from a transient
 * email-service failure so the route can map it to a 503.
 */
export class BankAccountConfigError extends Error {
    constructor() {
        super('BANK_TRANSFER_INSTRUCTIONS_JSON has no valid accounts configured.');
        this.name = 'BankAccountConfigError';
    }
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
        const filtered = parsed.filter((a): a is BankAccount => {
            if (typeof a !== 'object' || a === null) return false;
            const obj = a as Record<string, unknown>;
            return (
                typeof obj.bank === 'string' &&
                typeof obj.accountType === 'string' &&
                typeof obj.accountNumber === 'string' &&
                typeof obj.accountName === 'string'
            );
        });
        if (filtered.length === 0) {
            logger.warn('BANK_TRANSFER_INSTRUCTIONS_JSON parsed but produced zero valid accounts');
        }
        return filtered;
    } catch (e) {
        logger.error({ err: e instanceof Error ? e.message : String(e) }, 'Invalid BANK_TRANSFER_INSTRUCTIONS_JSON');
        return [];
    }
}

/**
 * Sends manual-transfer instructions email via the shared Resend client
 * (with built-in retry logic from `sendEmail`).
 *
 * Throws `BankAccountConfigError` if no bank accounts are configured. All
 * other errors come from `sendEmail` (transient/permanent Resend errors).
 */
export async function sendTransferInstructionsEmail({ to, variant, referenceCode }: SendArgs) {
    const accounts = getBankAccounts();
    if (accounts.length === 0) {
        throw new BankAccountConfigError();
    }

    await sendEmail({
        to,
        subject: `Instrucciones de pago — ${variant.label}`,
        react: TransferInstructions({
            variantLabel: variant.label,
            priceQ: variant.priceQ,
            accounts,
            referenceCode,
        }),
    });
}
