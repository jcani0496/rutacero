/**
 * IP Whitelisting for Cron Jobs
 *
 * Vercel Cron jobs come from specific IP ranges
 */

// Vercel Cron IP ranges (update from https://vercel.com/docs/cron-jobs/manage-cron-jobs)
const VERCEL_CRON_IP_RANGES = [
  '76.76.21.0/24',
  '76.76.21.21',
  '76.76.21.22',
  '76.76.21.23',
  '76.76.21.164',
  '76.76.21.165',
];

/**
 * Checks if an IP is within a CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');

  if (!bits) {
    // Not a CIDR, just exact match
    return ip === range;
  }

  const ipParts = ip.split('.').map(Number);
  const rangeParts = range.split('.').map(Number);
  const prefixLength = parseInt(bits, 10);

  // Convert IPs to 32-bit integers
  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];

  // Create subnet mask
  const mask = -1 << (32 - prefixLength);

  // Check if IP is in range
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Checks if IP is from Vercel Cron
 */
export function isVercelCronIP(ip: string): boolean {
  // Localhost for development
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return process.env.NODE_ENV === 'development';
  }

  return VERCEL_CRON_IP_RANGES.some(range => isIPInCIDR(ip, range));
}

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
