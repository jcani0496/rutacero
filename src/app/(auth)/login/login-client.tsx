'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { getOnboardingStatus } from '@/lib/actions/profile';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowRight,
    CircleNotch,
    Envelope,
    Lock,
    ShieldCheck
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';


const useBetterAuth = true;
// Dead Supabase branches kept for reference; never instantiated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = null;

export default function LoginClient() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
    const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const searchParams = useSearchParams();

    const blockedParam = searchParams.get('blocked');
    const mfaParam = searchParams.get('mfa');

    useEffect(() => {
        if (blockedParam) {
            setMessage({
                type: 'error',
                text: 'Tu cuenta está bloqueada temporalmente. Contacta a soporte si necesitas ayuda.',
            });
        }
        if (useBetterAuth && mfaParam) {
            setMfaRequired(true);
            setMessage({
                type: 'success',
                text: 'Ingresa el código de tu autenticador para continuar.',
            });
        }
    }, [blockedParam, mfaParam]);

    const routeAfterLogin = async () => {
        // Dual-path profile lookup via server action (DATA_PROVIDER).
        // Works for both Supabase Auth and better-auth session cookies.
        try {
            const status = await getOnboardingStatus();
            const target = !status?.onboardingCompleted ? '/onboarding' : '/dashboard';
            window.location.assign(target);
        } catch {
            window.location.assign('/dashboard');
        }
    };

    const validateLoginAttempt = async () => {
        const response = await fetch('/api/auth/login-attempt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, outcome: 'precheck' }),
        });

        if (response.ok) {
            return;
        }

        const payload = await response.json().catch(() => ({} as { error?: string; message?: string }));
        const message = payload.message || payload.error || 'No se pudo validar el intento de inicio de sesión';
        throw new Error(message);
    };

    const reportLoginAttempt = async (outcome: 'success' | 'failure') => {
        await fetch('/api/auth/login-attempt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, outcome }),
        });
    };

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            await validateLoginAttempt();

            if (useBetterAuth) {
                const { data, error } = await authClient.signIn.email({
                    email,
                    password,
                });

                if (error) {
                    await reportLoginAttempt('failure').catch(() => undefined);
                    throw new Error(error.message || 'Error al iniciar sesión');
                }

                // twoFactor plugin redirects via onTwoFactorRedirect when MFA is required.
                if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
                    await reportLoginAttempt('success').catch(() => undefined);
                    setMfaRequired(true);
                    setMessage({
                        type: 'success',
                        text: 'Ingresa el código de tu autenticador para continuar.',
                    });
                    return;
                }

                const session = await authClient.getSession();
                const userId = session.data?.user?.id;
                if (!userId) {
                    throw new Error('No se pudo iniciar sesión');
                }

                await reportLoginAttempt('success').catch(() => undefined);
                await routeAfterLogin();
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                const errorCode = (error as { code?: string }).code;
                if (errorCode === 'user_banned' || /banned/i.test(error.message)) {
                    await reportLoginAttempt('failure').catch(() => undefined);
                    setMessage({
                        type: 'error',
                        text: 'Usuario bloqueado. Contacta a soporte para desbloquear la cuenta.',
                    });
                    return;
                }
                await reportLoginAttempt('failure').catch(() => undefined);
                throw error;
            }

            if (!data.session) {
                throw new Error('No se pudo iniciar sesión');
            }

            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const requiresMfa = aalData?.nextLevel === 'aal2' && aalData?.currentLevel === 'aal1';

            if (requiresMfa) {
                await reportLoginAttempt('success').catch(() => undefined);
                const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
                if (factorError) throw factorError;

                const factor = factorData?.totp?.[0]
                    || factorData?.all?.find((item: { factor_type?: string; status?: string }) => item.factor_type === 'totp' && item.status === 'verified');

                if (!factor) {
                    throw new Error('No encontramos un factor TOTP activo');
                }

                const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                    factorId: factor.id,
                });

                if (challengeError) throw challengeError;

                setMfaRequired(true);
                setMfaFactorId(factor.id);
                setMfaChallengeId(challengeData?.id || null);
                setMessage({
                    type: 'success',
                    text: 'Ingresa el código de tu autenticador para continuar.',
                });
                return;
            }

            await reportLoginAttempt('success').catch(() => undefined);
            await routeAfterLogin();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Error al iniciar sesión',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleMfaVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            if (useBetterAuth) {
                const { error } = await authClient.twoFactor.verifyTotp({
                    code: mfaCode.trim(),
                });
                if (error) throw new Error(error.message || 'Código inválido');

                const session = await authClient.getSession();
                const userId = session.data?.user?.id;
                if (!userId) {
                    throw new Error('No se pudo completar la verificación');
                }
                await routeAfterLogin();
                return;
            }

            if (!mfaFactorId || !mfaChallengeId) {
                throw new Error('Sesión MFA incompleta. Intenta nuevamente.');
            }

            const { error } = await supabase.auth.mfa.verify({
                factorId: mfaFactorId,
                challengeId: mfaChallengeId,
                code: mfaCode.trim(),
            });

            if (error) throw error;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No se pudo completar la verificación');
            }

            await routeAfterLogin();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Código inválido',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="sr-only">Iniciar sesión en RutaCero</h1>

            <div className="flex justify-center lg:hidden">
                <BrandLogo height={44} priority variant="light" />
            </div>

            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">
                    Tu cuenta
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {mfaRequired ? 'Verifica tu identidad' : 'Inicia sesión'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {mfaRequired
                        ? 'Ingresa el código de tu autenticador para continuar.'
                        : 'Ingresa tu email y contraseña para seguir tu plan.'}
                </p>
            </div>

            <form onSubmit={mfaRequired ? handleMfaVerify : handlePasswordLogin} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Envelope className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={mfaRequired}
                            aria-invalid={message?.type === 'error'}
                            aria-describedby={message?.type === 'error' ? 'login-error' : undefined}
                            className="h-11 bg-card pl-10 text-base sm:h-12"
                        />
                    </div>
                </div>

                {!mfaRequired && (
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                aria-invalid={message?.type === 'error'}
                                aria-describedby={message?.type === 'error' ? 'login-error' : undefined}
                                className="h-11 bg-card pl-10 text-base sm:h-12"
                            />
                        </div>
                    </div>
                )}

                {mfaRequired && (
                    <div className="space-y-2">
                        <Label htmlFor="mfa">Código de verificación</Label>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="mfa"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="123456"
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value)}
                                required
                                aria-invalid={message?.type === 'error'}
                                aria-describedby={message?.type === 'error' ? 'login-error' : undefined}
                                className="h-11 bg-card pl-10 text-base sm:h-12"
                            />
                        </div>
                    </div>
                )}

                {message && (
                    <div
                        id={message.type === 'error' ? 'login-error' : undefined}
                        role={message.type === 'error' ? 'alert' : 'status'}
                        aria-live={message.type === 'error' ? 'assertive' : 'polite'}
                        className={`rounded-md border px-3 py-2.5 text-sm ${
                            message.type === 'error'
                                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                                : 'border-primary/20 bg-accent text-[var(--rc-teal-text)]'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <Button
                    type="submit"
                    className="h-11 w-full text-base sm:h-12"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                        </>
                    ) : (
                        <>
                            {mfaRequired ? 'Verificar código' : 'Entrar'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </Button>

                {!mfaRequired && (
                    <div className="flex items-center justify-between gap-4 text-sm">
                        <Link
                            href="/forgot-password"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            ¿Olvidaste tu contraseña?
                        </Link>
                        <Link
                            href="/signup"
                            className="font-medium text-[var(--rc-teal-text)] transition-colors hover:text-primary"
                        >
                            Crear cuenta
                        </Link>
                    </div>
                )}
            </form>
        </div>
    );
}
