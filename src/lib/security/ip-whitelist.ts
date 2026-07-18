/**
 * Cron endpoint authentication.
 *
 * Auth model: a strong bearer CRON_SECRET is the single gate. The old
 * Vercel-Cron IP allowlist was removed in the Railway migration — the
 * callers are now GitHub Actions scheduled workflows, whose runner IPs
 * are a huge dynamic pool that cannot be meaningfully allowlisted. The
 * secret check (≥32 chars, weak-string screening) plus per-IP rate
 * limiting on the routes is the effective control.
 */

/**
 * Validates CRON_SECRET strength
 */
export function validateCronSecret(secret: string | undefined): void {
  if (!secret) {
    throw new Error(
      'CRON_SECRET is not configured. Set it in environment variables.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'CRON_SECRET must be at least 32 characters long for security.'
    );
  }

  // Check for weak secrets
  const weakSecrets = ['secret', 'password', '12345', 'test', 'demo'];
  if (weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
    throw new Error(
      'CRON_SECRET appears to be weak. Use a cryptographically random string.'
    );
  }
}
