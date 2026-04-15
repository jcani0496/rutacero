import type { AdminRole } from '@/lib/actions/admin-auth';

export const ADMIN_SESSION_ISSUER = 'rutacero-admin';
export const ADMIN_SESSION_AUDIENCE = 'rutacero-admin-panel';

export interface AdminSessionClaims {
  adminId: string;
  email: string;
  role: AdminRole;
  displayName: string | null;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
}

interface VerificationResult {
  valid: boolean;
  payload?: AdminSessionClaims;
  reason?: string;
}

function normalizeBase64Url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  return pad === 0 ? base64 : `${base64}${'='.repeat(4 - pad)}`;
}

function decodeBase64UrlToString(input: string): string {
  const normalized = normalizeBase64Url(input);

  if (typeof atob === 'function') {
    return atob(normalized);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64').toString('utf8');
  }

  throw new Error('No base64 decoder available');
}

function decodeBase64UrlToBytes(input: string): Uint8Array {
  const normalized = normalizeBase64Url(input);

  if (typeof atob === 'function') {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(normalized, 'base64'));
  }

  throw new Error('No base64 decoder available');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function parseJsonPart<T>(input: string): T | null {
  try {
    return JSON.parse(decodeBase64UrlToString(input)) as T;
  } catch {
    return null;
  }
}

function isValidAudience(aud: string | string[] | undefined) {
  if (!aud) return false;
  return Array.isArray(aud)
    ? aud.includes(ADMIN_SESSION_AUDIENCE)
    : aud === ADMIN_SESSION_AUDIENCE;
}

function isValidPayload(payload: AdminSessionClaims): payload is AdminSessionClaims {
  return Boolean(
    payload &&
      typeof payload.adminId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.role === 'string'
  );
}

async function verifySignature(token: string, secret: string, signaturePart: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;

  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = decodeBase64UrlToBytes(signaturePart);
  const signedContent = token.split('.').slice(0, 2).join('.');

  return subtle.verify(
    'HMAC',
    key,
    toArrayBuffer(signature),
    toArrayBuffer(encoder.encode(signedContent))
  );
}

export async function verifyAdminSessionToken(
  token: string | null | undefined,
  secret: string | null | undefined
): Promise<VerificationResult> {
  if (!token) return { valid: false, reason: 'missing_token' };
  if (!secret) return { valid: false, reason: 'missing_secret' };

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'invalid_token_format' };
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parseJsonPart<{ alg?: string; typ?: string }>(headerPart);
  const payload = parseJsonPart<AdminSessionClaims>(payloadPart);

  if (!header || header.alg !== 'HS256') {
    return { valid: false, reason: 'invalid_header' };
  }

  if (!payload || !isValidPayload(payload)) {
    return { valid: false, reason: 'invalid_payload' };
  }

  if (payload.iss !== ADMIN_SESSION_ISSUER || !isValidAudience(payload.aud)) {
    return { valid: false, reason: 'invalid_claims' };
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    return { valid: false, reason: 'expired_token' };
  }

  const signatureValid = await verifySignature(token, secret, signaturePart);
  if (!signatureValid) {
    return { valid: false, reason: 'invalid_signature' };
  }

  return { valid: true, payload };
}
