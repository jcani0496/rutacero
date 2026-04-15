import { verifySync } from 'otplib';

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production';
}

export function isTotpRequired() {
  return isProductionEnvironment() || !!process.env.ADMIN_MFA_TOTP_SECRET;
}

export function verifyTotpCode(code: string | null | undefined) {
  const secret = process.env.ADMIN_MFA_TOTP_SECRET;
  if (!secret) return !isProductionEnvironment();
  if (!code) return false;
  const result = verifySync({
    token: code.trim(),
    secret,
    period: 30,
    epochTolerance: 30,
  });
  return result.valid;
}
