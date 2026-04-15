import { Resend } from 'resend';
import pRetry, { AbortError } from 'p-retry';

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        resendClient = new Resend(apiKey);
    }

    return resendClient;
}

export interface SendEmailParams {
    to: string | string[];
    subject: string;
    html?: string;
    react?: React.ReactElement;
    from?: string;
}

/**
 * Sends an email with retry logic (VUL-009 remediation)
 * Retries up to 3 times with exponential backoff on transient failures
 *
 * @param params - Email parameters
 * @returns Email send result
 */
export async function sendEmail(params: SendEmailParams) {
    const resend = getResendClient();
    const fromAddress = params.from || 'RutaCero <notificaciones@rutacero.com>';

    return pRetry(
        async () => {
            const { data, error } = await resend.emails.send({
                from: fromAddress,
                to: params.to,
                subject: params.subject,
                html: params.html,
                react: params.react,
            });

            if (error) {
                console.error('Error sending email:', error);

                // Check if error is permanent (don't retry)
                if (isPermanentEmailError(error)) {
                    throw new AbortError(`Permanent email error: ${error.message}`);
                }

                // Transient error - will retry
                throw new Error(`Transient email error: ${error.message}`);
            }

            return data;
        },
        {
            retries: 3,
            factor: 2, // Exponential backoff factor
            minTimeout: 1000, // 1 second
            maxTimeout: 10000, // 10 seconds
            onFailedAttempt: (error) => {
                console.warn(
                    `Email send attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
                );
            },
        }
    );
}

/**
 * Determines if an email error is permanent and should not be retried
 *
 * @param error - Email error
 * @returns true if error is permanent
 */
function isPermanentEmailError(error: unknown): boolean {
    const permanentErrorCodes = [
        'validation_error',
        'invalid_email',
        'invalid_from_address',
        'invalid_api_key',
        'missing_required_field',
    ];

    const record: Record<string, unknown> =
        typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
    const code = typeof record.code === 'string' ? record.code : null;
    const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';

    // Check if error has a code that indicates permanent failure
    if (code && permanentErrorCodes.includes(code)) {
        return true;
    }

    // Check error message for permanent failure indicators
    if (
        message.includes('invalid') ||
        message.includes('not found') ||
        message.includes('unauthorized') ||
        message.includes('forbidden')
    ) {
        return true;
    }

    return false;
}
