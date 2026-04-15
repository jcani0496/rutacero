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
    const { isTotpRequired, verifyTotpCode } = await loadModule();

    expect(isTotpRequired()).toBe(false);
    expect(verifyTotpCode(undefined)).toBe(true);
  });

  it('requires TOTP in production even if the secret is missing', async () => {
    env.NODE_ENV = 'production';
    const { isTotpRequired, verifyTotpCode } = await loadModule();

    expect(isTotpRequired()).toBe(true);
    expect(verifyTotpCode('123456')).toBe(false);
  });

  it('verifies the provided code when a secret exists', async () => {
    env.NODE_ENV = 'production';
    env.ADMIN_MFA_TOTP_SECRET = 'top-secret';
    verifySyncMock.mockReturnValue({ valid: true });

    const { verifyTotpCode } = await loadModule();

    expect(verifyTotpCode('123456')).toBe(true);
    expect(verifySyncMock).toHaveBeenCalledWith({
      token: '123456',
      secret: 'top-secret',
      period: 30,
      epochTolerance: 30,
    });
  });
});
