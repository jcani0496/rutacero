import { afterEach, describe, expect, it, vi } from 'vitest';

const verifySyncMock = vi.fn();
const env = process.env as Record<string, string | undefined>;

vi.mock('otplib', () => ({
  verifySync: verifySyncMock,
}));

async function loadModule() {
  return import('@/lib/security/totp');
}

describe('TOTP security behavior', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete env.ADMIN_MFA_TOTP_SECRET;
    delete env.NODE_ENV;
  });

  it('does not require TOTP in development without a secret', async () => {
    env.NODE_ENV = 'development';
    const { getTotpRequirementState, isTotpRequired, verifyTotpCode } = await loadModule();

    expect(getTotpRequirementState()).toBe('disabled');
    expect(isTotpRequired()).toBe(false);
    expect(verifyTotpCode(undefined)).toBe(true);
  });

  it('marks production without secret as misconfigured (blocks enabling MFA, not password login)', async () => {
    env.NODE_ENV = 'production';
    const { getTotpRequirementState, isTotpRequired, verifyTotpCode } = await loadModule();

    expect(getTotpRequirementState()).toBe('misconfigured');
    // Env not ready to verify codes; login skips MFA until admin.mfa_enabled.
    expect(isTotpRequired()).toBe(true);
    expect(verifyTotpCode('123456')).toBe(false);
  });

  it('verifies the provided code when a secret exists', async () => {
    env.NODE_ENV = 'production';
    env.ADMIN_MFA_TOTP_SECRET = 'top-secret';
    verifySyncMock.mockReturnValue({ valid: true });

    const { getTotpRequirementState, verifyTotpCode } = await loadModule();

    expect(getTotpRequirementState()).toBe('enabled');
    expect(verifyTotpCode('123456')).toBe(true);
    expect(verifySyncMock).toHaveBeenCalledWith({
      token: '123456',
      secret: 'top-secret',
      period: 30,
      epochTolerance: 30,
    });
  });
});
