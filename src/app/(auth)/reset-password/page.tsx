'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    CheckCircle,
    CircleNotch,
    Lock,
    Warning
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

        // Check for error in URL (from Supabase redirect)
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
            setSessionError(true);
            setError(errorDescription || 'Error de autenticación');
        }

        if (otpMode) {
            return;
        }

        // Listen for auth state changes (when user clicks reset link, they get a session)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
            if (event === 'PASSWORD_RECOVERY') {
                // User clicked the reset link and has a valid session
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
                    throw new Error('Ingresá el email y el código que te enviamos');
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

            // Redirect to dashboard after 2 seconds
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
            <div className="space-y-6 sm:space-y-8">
                <div className="flex justify-center lg:hidden">
                    <BrandLogo height={50} priority />
                </div>

                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                    <CardContent className="pt-6 text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="p-3 rounded-full bg-red-500/20">
                                <Warning className="w-8 h-8 text-red-400" />
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold text-white">Enlace inválido o expirado</h2>
                        <p className="text-slate-400">
                            {error || 'El enlace para restablecer tu contraseña ha expirado o ya fue utilizado.'}
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-3 pt-2">
                        <Link href="/forgot-password" className="w-full">
                            <Button className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600">
                                Solicitar nuevo enlace
                            </Button>
                        </Link>
                        <Link href="/login" className="text-center text-sm text-slate-400 hover:text-slate-300">
                            Volver al login
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="space-y-6 sm:space-y-8">
                <div className="flex justify-center lg:hidden">
                    <BrandLogo height={50} priority />
                </div>

                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                    <CardContent className="pt-6 text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="p-3 rounded-full bg-emerald-500/20">
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold text-white">¡Contraseña actualizada!</h2>
                        <p className="text-slate-400">
                            Tu contraseña ha sido cambiada exitosamente. Redirigiendo al dashboard...
                        </p>
                        <CircleNotch {...ICON} className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex justify-center lg:hidden">
                <BrandLogo height={50} priority />
            </div>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 pb-4 sm:pb-6">
                    <CardTitle className="text-xl sm:text-2xl text-white">
                        Nueva contraseña
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base text-slate-400">
                        {otpMode
                            ? 'Ingresá el código del correo y tu nueva contraseña.'
                            : 'Ingresa tu nueva contraseña para tu cuenta.'}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {otpMode && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-sm sm:text-base text-slate-300">
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-11 sm:h-12 text-base bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="otp" className="text-sm sm:text-base text-slate-300">
                                        Código
                                    </Label>
                                    <Input
                                        id="otp"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="123456"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                        className="h-11 sm:h-12 text-base bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm sm:text-base text-slate-300">
                                Nueva contraseña
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="pl-10 h-11 sm:h-12 text-base bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm sm:text-base text-slate-300">
                                Confirmar contraseña
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="pl-10 h-11 sm:h-12 text-base bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                                {error}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 sm:h-12 text-base bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium shadow-lg shadow-emerald-500/25"
                        >
                            {isLoading ? (
                                <>
                                    <CircleNotch {...ICON} className="w-4 h-4 mr-2 animate-spin" />
                                    Actualizando...
                                </>
                            ) : (
                                'Actualizar contraseña'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <CircleNotch {...ICON} className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
