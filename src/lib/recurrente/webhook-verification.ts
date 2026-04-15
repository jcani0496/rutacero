import crypto from 'crypto';

/**
 * Verifies the signature of a Recurrente webhook
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from x-recurrente-signature header
 * @param secret - RECURRENTE_WEBHOOK_SECRET from env
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret || !payload) {
    return false;
  }

  try {
    // Recurrente uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // If buffers have different lengths or any error occurs
    return false;
  }
}

/**
 * Validates that webhook secret is properly configured
 */
export function validateWebhookSecret(secret: string | undefined): void {
  if (!secret) {
    throw new Error(
      'RECURRENTE_WEBHOOK_SECRET is not configured. Please set it in your environment variables.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'RECURRENTE_WEBHOOK_SECRET must be at least 32 characters long for security.'
    );
  }
}
