import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION_AUDIENCE,
  ADMIN_SESSION_ISSUER,
  verifyAdminSessionToken,
} from '@/lib/security/admin-session';

const secret = 'super-secret-admin-jwt-key-for-tests';

describe('verifyAdminSessionToken', () => {
  afterEach(() => {
    delete process.env.ADMIN_JWT_SECRET;
  });

  it('accepts a valid HS256 token', async () => {
    const token = jwt.sign(
      {
        adminId: 'admin-1',
        email: 'admin@rutacero.gt',
        role: 'ADMIN',
        displayName: 'Admin',
      },
      secret,
      {
        expiresIn: '8h',
        issuer: ADMIN_SESSION_ISSUER,
        audience: ADMIN_SESSION_AUDIENCE,
      }
    );

    const result = await verifyAdminSessionToken(token, secret);

    expect(result.valid).toBe(true);
    expect(result.payload?.adminId).toBe('admin-1');
  });

  it('rejects expired tokens', async () => {
    const token = jwt.sign(
      {
        adminId: 'admin-1',
        email: 'admin@rutacero.gt',
        role: 'ADMIN',
        displayName: 'Admin',
      },
      secret,
      {
        expiresIn: -1,
        issuer: ADMIN_SESSION_ISSUER,
        audience: ADMIN_SESSION_AUDIENCE,
      }
    );

    const result = await verifyAdminSessionToken(token, secret);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired_token');
  });

  it('rejects tokens with invalid audience', async () => {
    const token = jwt.sign(
      {
        adminId: 'admin-1',
        email: 'admin@rutacero.gt',
        role: 'ADMIN',
        displayName: 'Admin',
      },
      secret,
      {
        expiresIn: '8h',
        issuer: ADMIN_SESSION_ISSUER,
        audience: 'wrong-audience',
      }
    );

    const result = await verifyAdminSessionToken(token, secret);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_claims');
  });
});
