'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    CheckCircle,
    CircleNotch,
    Lock,
    Warning,
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

const useBetterAuth = true;
// Dead Supabase branches kept for reference; never instantiated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = null;

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionError, setSessionError] = useState(false);
    const otpMode = useBetterAuth && searchParams.get('mode') === 'otp';

    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) setEmail(emailParam);

        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
            setSessionError(true);
            setError(errorDescription || 'Error de autenticación');
        }

        if (otpMode) {
            return;
        }

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event: string) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionError(false);
                setError(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [searchParams, otpMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (otpMode) {
                if (!email || !otp.trim()) {
                    throw new Error('Ingresa el email y el código que te enviamos');
                }
                const { error } = await authClient.emailOtp.resetPassword({
                    email,
                    otp: otp.trim(),
                    password,
                });
                if (error) throw new Error(error.message || 'No se pudo restablecer la contraseña');
            } else {
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
            }

            setSuccess(true);

            setTimeout(() => {
                router.push(otpMode ? '/login' : '/dashboard');
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña');
        } finally {
            setIsLoading(false);
        }
    };

    if (sessionError) {
        return (
            <div className="space-y-8">
                <div className="flex justify-center lg:hidden">
                    <BrandLogo height={44} priority variant="light" />
                </div>

                <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-destructive/30 bg-destructive/5">
                        <Warning className="h-6 w-6 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Enlace inválido o expirado
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {error ||
                            'El enlace para restablecer tu contraseña ha expirado o ya fue utilizado.'}
                    </p>
                </div>

                <div className="space-y-3">
                    <Button className="h-11 w-full sm:h-12" asChild>
                        <Link href="/forgot-password">Solicitar nuevo enlace</Link>
                    </Button>
                    <Link
                        href="/login"
                        className="block text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Volver al login
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="space-y-8">
                <div className="flex justify-center lg:hidden">
                    <BrandLogo height={44} priority variant="light" />
                </div>

                <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-primary/20 bg-accent">
                        <CheckCircle className="h-6 w-6 text-[var(--rc-teal-text)]" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Contraseña actualizada
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Tu contraseña se cambió correctamente. Redirigiendo…
                    </p>
                    <CircleNotch
                        {...ICON}
                        className="mx-auto h-6 w-6 animate-spin text-[var(--rc-teal-text)]"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-center lg:hidden">
                <BrandLogo height={44} priority variant="light" />
            </div>

            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">
                    Tu cuenta
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Nueva contraseña
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {otpMode
                        ? 'Ingresa el código del correo y tu nueva contraseña.'
                        : 'Ingresa tu nueva contraseña para tu cuenta.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {otpMode && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11 bg-card text-base sm:h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="otp">Código</Label>
                            <Input
                                id="otp"
                                type="text"
                                inputMode="numeric"
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                className="h-11 bg-card text-base sm:h-12"
                            />
                        </div>
                    </>
                )}

                <div className="space-y-2">
                    <Label htmlFor="password">Nueva contraseña</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="h-11 bg-card pl-10 text-base sm:h-12"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            className="h-11 bg-card pl-10 text-base sm:h-12"
                        />
                    </div>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                    >
                        {error}
                    </div>
                )}

                <Button type="submit" disabled={isLoading} className="h-11 w-full text-base sm:h-12">
                    {isLoading ? (
                        <>
                            <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                            Actualizando...
                        </>
                    ) : (
                        'Actualizar contraseña'
                    )}
                </Button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[400px] items-center justify-center">
                    <CircleNotch {...ICON} className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}
