import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { LOGGER_REDACT_PATHS } from '@/lib/logger';

/**
 * Two-layer test:
 * 1. Structural — guards against regression on the exported redact list.
 *    This is the safety net: if anyone removes a path, the next test only
 *    catches it if their specific field is exercised, but this test fails
 *    immediately for any of the well-known fields.
 * 2. Behavioral — spins up a fresh Pino instance with the same redact paths
 *    and an in-memory write target, then asserts that sensitive values do
 *    not appear in the serialized output. This avoids reaching into the
 *    real `logger`'s pino-pretty transport (which writes to stdout via a
 *    worker thread and is awkward to intercept in tests).
 */

describe('logger redact list', () => {
  it('contains existing auth/secret paths (regression guard)', () => {
    expect(LOGGER_REDACT_PATHS).toContain('password');
    expect(LOGGER_REDACT_PATHS).toContain('token');
    expect(LOGGER_REDACT_PATHS).toContain('authorization');
    expect(LOGGER_REDACT_PATHS).toContain('email');
    expect(LOGGER_REDACT_PATHS).toContain('secret');
  });

  it('redacts financial PII fields (audit hallazgo I-4)', () => {
    expect(LOGGER_REDACT_PATHS).toContain('bankReference');
    expect(LOGGER_REDACT_PATHS).toContain('*.bankReference');
    expect(LOGGER_REDACT_PATHS).toContain('amount');
    expect(LOGGER_REDACT_PATHS).toContain('*.amount');
    expect(LOGGER_REDACT_PATHS).toContain('priceQ');
    expect(LOGGER_REDACT_PATHS).toContain('*.priceQ');
    expect(LOGGER_REDACT_PATHS).toContain('creditor');
    expect(LOGGER_REDACT_PATHS).toContain('*.creditor');
    expect(LOGGER_REDACT_PATHS).toContain('balance');
    expect(LOGGER_REDACT_PATHS).toContain('*.balance');
  });

  it('redacts contact / profile PII fields', () => {
    expect(LOGGER_REDACT_PATHS).toContain('phone');
    expect(LOGGER_REDACT_PATHS).toContain('*.phone');
    expect(LOGGER_REDACT_PATHS).toContain('phoneE164');
    expect(LOGGER_REDACT_PATHS).toContain('*.phoneE164');
    expect(LOGGER_REDACT_PATHS).toContain('displayName');
    expect(LOGGER_REDACT_PATHS).toContain('*.displayName');
    expect(LOGGER_REDACT_PATHS).toContain('address');
    expect(LOGGER_REDACT_PATHS).toContain('*.address');
  });

  it('redacts known sensitive metadata paths', () => {
    expect(LOGGER_REDACT_PATHS).toContain('metadata.email');
    expect(LOGGER_REDACT_PATHS).toContain('metadata.bankReference');
    expect(LOGGER_REDACT_PATHS).toContain('metadata.amount');
    expect(LOGGER_REDACT_PATHS).toContain('metadata.referenceCode');
  });

  it('does NOT redact correlation IDs needed for tracing', () => {
    expect(LOGGER_REDACT_PATHS).not.toContain('tenantId');
    expect(LOGGER_REDACT_PATHS).not.toContain('userId');
    expect(LOGGER_REDACT_PATHS).not.toContain('requestId');
    expect(LOGGER_REDACT_PATHS).not.toContain('*.tenantId');
    expect(LOGGER_REDACT_PATHS).not.toContain('*.userId');
    expect(LOGGER_REDACT_PATHS).not.toContain('*.requestId');
  });
});

describe('logger redact behavior', () => {
  /**
   * Build a test logger with the exact same redact config the real logger
   * uses, but writing to an in-memory buffer so we can assert on output.
   */
  function buildTestLogger() {
    const lines: string[] = [];
    const stream = {
      write(chunk: string) {
        lines.push(chunk);
      },
    };
    const testLogger = pino(
      {
        level: 'debug',
        redact: {
          paths: LOGGER_REDACT_PATHS,
          censor: '[REDACTED]',
        },
      },
      stream as unknown as pino.DestinationStream,
    );
    return { testLogger, lines };
  }

  it('redacts financial PII at the top level', () => {
    const { testLogger, lines } = buildTestLogger();

    testLogger.error(
      {
        bankReference: 'BI-12345',
        amount: 1500,
        priceQ: 49,
        creditor: 'BAC',
        balance: 9500,
        phone: '+50212345678',
        phoneE164: '+50287654321',
        displayName: 'Juan Perez',
        address: '12 calle 5-30',
      },
      'test redact top-level',
    );

    const output = lines.join('');
    expect(output).not.toContain('BI-12345');
    expect(output).not.toContain('1500');
    expect(output).not.toContain('"amount":1500');
    expect(output).not.toContain('BAC');
    expect(output).not.toContain('9500');
    expect(output).not.toContain('+50212345678');
    expect(output).not.toContain('+50287654321');
    expect(output).not.toContain('Juan Perez');
    expect(output).not.toContain('12 calle 5-30');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts financial PII at nested paths via wildcard', () => {
    const { testLogger, lines } = buildTestLogger();

    testLogger.warn(
      {
        type: 'payment_event',
        payload: {
          bankReference: 'BI-99999',
          amount: 7777,
          creditor: 'Banrural',
          balance: 4321,
        },
      },
      'test redact nested',
    );

    const output = lines.join('');
    expect(output).not.toContain('BI-99999');
    expect(output).not.toContain('7777');
    expect(output).not.toContain('Banrural');
    expect(output).not.toContain('4321');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts metadata.* paths used by audit logs', () => {
    const { testLogger, lines } = buildTestLogger();

    testLogger.info(
      {
        type: 'audit',
        metadata: {
          email: 'audit@example.com',
          bankReference: 'BI-AUDIT-1',
          amount: 999,
          referenceCode: 'REF-XYZ-42',
        },
      },
      'test redact metadata',
    );

    const output = lines.join('');
    expect(output).not.toContain('audit@example.com');
    expect(output).not.toContain('BI-AUDIT-1');
    expect(output).not.toContain('999');
    expect(output).not.toContain('REF-XYZ-42');
    expect(output).toContain('[REDACTED]');
  });

  it('preserves correlation fields (tenantId, userId, requestId)', () => {
    const { testLogger, lines } = buildTestLogger();

    testLogger.info(
      {
        tenantId: 'tenant-abc-123',
        userId: 'user-def-456',
        requestId: 'req-ghi-789',
      },
      'test correlation preserved',
    );

    const output = lines.join('');
    expect(output).toContain('tenant-abc-123');
    expect(output).toContain('user-def-456');
    expect(output).toContain('req-ghi-789');
  });
});
