'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, ArrowRight, BarChart3, Target, Bell, Lock, ShieldCheck } from 'lucide-react';

export default function LoginClient() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
    const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const supabase = createClient();
    const searchParams = useSearchParams();

    const blockedParam = searchParams.get('blocked');

    useEffect(() => {
        if (blockedParam) {
            setMessage({
                type: 'error',
                text: 'Tu cuenta está bloqueada temporalmente. Contacta a soporte si necesitas ayuda.',
            });
        }
    }, [blockedParam]);

    const routeAfterLogin = async (session: { user: { id: string } }) => {
        const { data: profileData } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('user_id', session.user.id)
            .maybeSingle();

        const profile = profileData as { onboarding_completed: boolean } | null;

        const target = !profile?.onboarding_completed ? '/onboarding' : '/dashboard';

        // Full navigation avoids edge-cases where the session cookie/local storage isn't
        // visible to Server Components until a refresh.
        window.location.assign(target);
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
                    || factorData?.all?.find((item) => item.factor_type === 'totp' && item.status === 'verified');

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
            await routeAfterLogin(data.session);
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

            await routeAfterLogin(session);
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
        <div className="space-y-6 sm:space-y-8">
            {/* Logo - Only visible on mobile */}
            <div className="flex justify-center lg:hidden">
                <BrandLogo height={50} priority />
            </div>

            <Card className="border-slate-200 bg-white/90 backdrop-blur-xl shadow-xl">
                <CardHeader className="space-y-1 pb-4 sm:pb-6">
                    <CardTitle className="text-xl sm:text-2xl text-slate-900">Bienvenido</CardTitle>
                    <CardDescription className="text-sm sm:text-base text-slate-500">
                        {mfaRequired
                            ? 'Protege tu cuenta con el código de tu autenticador'
                            : 'Ingresa tu email y contraseña'
                        }
                    </CardDescription>
                </CardHeader>
                <form onSubmit={mfaRequired ? handleMfaVerify : handlePasswordLogin}>
                    <CardContent className="space-y-4">
                        {/* Email field */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm sm:text-base text-slate-700">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={mfaRequired}
                                    className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>

                        {!mfaRequired && (
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm sm:text-base text-slate-700">Contraseña</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>
                        )}

                        {mfaRequired && (
                            <div className="space-y-2">
                                <Label htmlFor="mfa" className="text-sm sm:text-base text-slate-700">Código de verificación</Label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="mfa"
                                        type="text"
                                        placeholder="123456"
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value)}
                                        required
                                        className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>
                        )}

                        {message && (
                            <div className={`rounded-lg p-3 text-sm ${message.type === 'error'
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                            >
                                {message.text}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full h-11 sm:h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                <>
                                    {mfaRequired ? 'Verificar código' : 'Ingresar'}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>

                        {!mfaRequired && (
                            <div className="flex items-center justify-between w-full text-sm text-slate-500">
                                <Link
                                    href="/forgot-password"
                                    className="hover:text-emerald-600 transition-colors"
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                                <Link
                                    href="/signup"
                                    className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                                >
                                    Crear cuenta
                                </Link>
                            </div>
                        )}
                    </CardFooter>
                </form>
            </Card>

            {!mfaRequired && (
                <div className="grid gap-3 text-xs sm:text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                        <span>Tu progreso financiero en un solo lugar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-500" />
                        <span>Planes inteligentes para salir de deudas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-emerald-500" />
                        <span>Alertas y seguimiento personalizado</span>
                    </div>
                </div>
            )}
        </div>
    );
}
