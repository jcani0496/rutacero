import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { logSecurityEvent } from '@/lib/logger';
import {
  checkLoginLockout,
  clearLoginFailures,
  formatRetryTime,
  registerLoginFailure,
} from '@/lib/security/login-lockout';

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes('@')) return null;
  return email;
}

export async function POST(request: NextRequest) {
  const ip = getClientIdentifier(request);

  try {
    const payload = (await request.json()) as {
      email?: unknown;
      outcome?: 'precheck' | 'success' | 'failure';
    };
    const email = normalizeEmail(payload.email);

    if (!email) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const outcome = payload.outcome ?? 'precheck';

    if (outcome === 'success') {
      await clearLoginFailures('user', email, ip);
      return NextResponse.json({ ok: true });
    }

    if (outcome === 'failure') {
      const lockState = await registerLoginFailure('user', email, ip);
      if (lockState.blocked) {
        return NextResponse.json(
          {
            error: 'Cuenta temporalmente bloqueada',
            message: `Demasiados intentos fallidos. Intenta nuevamente en ${formatRetryTime(lockState.retryAfterSeconds)}.`,
          },
          { status: 429 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    const lockout = await checkLoginLockout('user', email);
    if (lockout.blocked) {
      return NextResponse.json(
        {
          error: 'Cuenta temporalmente bloqueada',
          message: `Tu cuenta está bloqueada temporalmente. Intenta nuevamente en ${formatRetryTime(lockout.retryAfterSeconds)}.`,
        },
        { status: 429 }
      );
    }

    const accountLimit = await applyRateLimit(`login:account:${email}`, 'login');
    const ipLimit = await applyRateLimit(`login:ip:${ip}`, 'login');

    if (!accountLimit.success || !ipLimit.success) {
      logSecurityEvent({
        event: 'rate_limit_exceeded',
        ip,
        path: '/api/auth/login-attempt',
        details: { email },
      });
      return NextResponse.json(
        {
          error: 'Demasiados intentos de inicio de sesión',
          message: 'Intenta nuevamente en unos minutos',
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }
}
