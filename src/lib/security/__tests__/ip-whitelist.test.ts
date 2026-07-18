import { describe, it, expect } from 'vitest';
import { validateCronSecret } from '../ip-whitelist';

// isVercelCronIP and its CIDR tests were removed with the Railway
// migration: cron callers are now GitHub Actions scheduled workflows,
// so the bearer CRON_SECRET is the single auth gate.

describe('Cron secret validation', () => {
  describe('validateCronSecret', () => {
    it('should accept valid secret', () => {
      const validSecret = 'a'.repeat(32);
      expect(() => validateCronSecret(validSecret)).not.toThrow();
    });

    it('should reject undefined secret', () => {
      expect(() => validateCronSecret(undefined)).toThrow(
        'CRON_SECRET is not configured'
      );
    });

    it('should reject short secret', () => {
      expect(() => validateCronSecret('short')).toThrow(
        'must be at least 32 characters long'
      );
    });

    it('should reject weak secrets', () => {
      expect(() => validateCronSecret('password123456789012345678901234')).toThrow(
        'appears to be weak'
      );
      expect(() => validateCronSecret('secret12345678901234567890123456')).toThrow(
        'appears to be weak'
      );
    });

    it('should accept cryptographically random secret', () => {
      const randomSecret = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      expect(() => validateCronSecret(randomSecret)).not.toThrow();
    });
  });
});
