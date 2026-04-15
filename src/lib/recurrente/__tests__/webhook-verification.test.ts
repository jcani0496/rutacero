import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature, validateWebhookSecret } from '../webhook-verification';

describe('Webhook Signature Verification', () => {
  const secret = 'test_secret_key_with_sufficient_length_32chars';
  const payload = JSON.stringify({
    id: 'evt_123',
    type: 'payment_intent.succeeded',
    data: { id: 'pi_456' },
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const result = verifyWebhookSignature(payload, validSignature, secret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const invalidSignature = 'invalid_signature_12345';

      const result = verifyWebhookSignature(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it('should reject empty signature', () => {
      const result = verifyWebhookSignature(payload, '', secret);
      expect(result).toBe(false);
    });

    it('should reject empty payload', () => {
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const result = verifyWebhookSignature('', validSignature, secret);
      expect(result).toBe(false);
    });

    it('should reject empty secret', () => {
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const result = verifyWebhookSignature(payload, validSignature, '');
      expect(result).toBe(false);
    });

    it('should reject signature for different payload', () => {
      const differentPayload = JSON.stringify({ id: 'evt_999' });
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const result = verifyWebhookSignature(differentPayload, signature, secret);
      expect(result).toBe(false);
    });

    it('should handle timing attacks safely', () => {
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      // Signature with different length should fail safely
      const shorterSignature = validSignature.slice(0, -1);

      const result = verifyWebhookSignature(payload, shorterSignature, secret);
      expect(result).toBe(false);
    });
  });

  describe('validateWebhookSecret', () => {
    it('should accept valid secret', () => {
      expect(() => validateWebhookSecret(secret)).not.toThrow();
    });

    it('should reject undefined secret', () => {
      expect(() => validateWebhookSecret(undefined)).toThrow(
        'RECURRENTE_WEBHOOK_SECRET is not configured'
      );
    });

    it('should reject short secret', () => {
      expect(() => validateWebhookSecret('short')).toThrow(
        'must be at least 32 characters long'
      );
    });

    it('should accept secret exactly 32 characters', () => {
      const exactSecret = 'a'.repeat(32);
      expect(() => validateWebhookSecret(exactSecret)).not.toThrow();
    });

    it('should accept secret longer than 32 characters', () => {
      const longSecret = 'a'.repeat(64);
      expect(() => validateWebhookSecret(longSecret)).not.toThrow();
    });
  });
});
