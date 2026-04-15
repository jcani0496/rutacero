import { describe, it, expect } from 'vitest';
import { isVercelCronIP, validateCronSecret } from '../ip-whitelist';

describe('IP Whitelisting', () => {
  describe('isVercelCronIP', () => {
    it('should allow Vercel Cron IPs', () => {
      expect(isVercelCronIP('76.76.21.21')).toBe(true);
      expect(isVercelCronIP('76.76.21.22')).toBe(true);
      expect(isVercelCronIP('76.76.21.23')).toBe(true);
    });

    it('should allow IPs in CIDR range', () => {
      expect(isVercelCronIP('76.76.21.50')).toBe(true); // Within /24
      expect(isVercelCronIP('76.76.21.100')).toBe(true); // Within /24
      expect(isVercelCronIP('76.76.21.255')).toBe(true); // Within /24
    });

    it('should reject IPs outside range', () => {
      expect(isVercelCronIP('192.168.1.1')).toBe(false);
      expect(isVercelCronIP('10.0.0.1')).toBe(false);
      expect(isVercelCronIP('76.76.22.21')).toBe(false); // Different subnet
    });
  });

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
