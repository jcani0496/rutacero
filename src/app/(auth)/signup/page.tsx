'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/brand-logo';
import { trackMarketingEvent } from '@/lib/funnel/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropoffCapture } from '@/components/funnel/dropoff-capture';
import { recordSignupConsent } from '@/lib/actions/consent';
import { Mail, Loader2, ArrowRight, CheckCircle2, ShieldCheck, Lock, User as UserIcon } from 'lucide-react';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;

export default function SignupPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState<'email' | 'verify' | 'password'>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const supabase = createClient();
    const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const passwordStrength = (() => {
        let score = 0;
        if (password.length >= 8) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        const levels = [
            { label: 'Muy débil', color: 'bg-red-500', text: 'text-red-400' },
            { label: 'Débil', color: 'bg-orange-500', text: 'text-orange-400' },
            { label: 'Media', color: 'bg-yellow-500', text: 'text-yellow-400' },
            { label: 'Fuerte', color: 'bg-emerald-500', text: 'text-emerald-400' },
            { label: 'Muy fuerte', color: 'bg-emerald-500', text: 'text-emerald-400' },
        ];

        const clamped = Math.min(score, 4);
        const level = levels[clamped];

        return {
            score: clamped,
            percent: clamped === 0 ? 8 : (clamped / 4) * 100,
            label: level.label,
            barColor: level.color,
            textColor: level.text,
        };
    })();

    const passwordValid = password.length >= 8 && passwordStrength.score >= 2;
    const submitDisabled =
        isLoading ||
        (step === 'email' && !acceptedTerms) ||
        (step === 'password' && (!passwordValid || password !== confirmPassword));

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        if (!acceptedTerms) {
            setMessage({
                type: 'error',
                text: 'Debes aceptar los Términos y la Política de Privacidad para continuar.',
            });
            setIsLoading(false);
            return;
        }

        const trimmedName = fullName.trim();
        if (trimmedName.length < DISPLAY_NAME_MIN) {
            setMessage({
                type: 'error',
                text: 'Ingresa tu nombre completo (mínimo 2 caracteres).',
            });
            setIsLoading(false);
            return;
        }
        if (trimmedName.length > DISPLAY_NAME_MAX) {
            setMessage({
                type: 'error',
                text: `El nombre no puede tener más de ${DISPLAY_NAME_MAX} caracteres.`,
            });
            setIsLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo,
                    data: {
                        full_name: trimmedName,
                    },
                },
            });

            if (error) throw error;

            setMessage({
                type: 'success',
                text: 'Te enviamos un código de verificación a tu correo.',
            });
            void trackMarketingEvent({
                eventName: 'signup_started',
                email,
                ctaContext: 'signup',
            });
            setStep('verify');
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Ocurrió un error al enviar el código',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: otp.trim(),
                type: 'email',
            });

            if (error) throw error;

            // Record the user's acceptance of ToS + Privacy + Financial Disclaimer
            // now that we have a real user.id. Errors are swallowed inside the
            // action so signup can never fail because of consent logging.
            const newUserId = data?.user?.id;
            if (newUserId) {
                void recordSignupConsent(newUserId);
            }

            setMessage({
                type: 'success',
                text: 'Código verificado. Ahora define tu contraseña.',
            });
            void trackMarketingEvent({
                eventName: 'email_verified',
                email,
                ctaContext: 'signup',
            });
            setStep('password');
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Código inválido o expirado',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        if (password !== confirmPassword) {
            setMessage({
                type: 'error',
                text: 'Las contraseñas no coinciden',
            });
            setIsLoading(false);
            return;
        }

        if (password.length < 8) {
            setMessage({
                type: 'error',
                text: 'La contraseña debe tener al menos 8 caracteres',
            });
            setIsLoading(false);
            return;
        }

        if (passwordStrength.score < 2) {
            setMessage({
                type: 'error',
                text: 'La contraseña es demasiado débil. Usa mayúsculas, números o símbolos.',
            });
            setIsLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            router.push('/onboarding');
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Ocurrió un error al guardar la contraseña',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setIsLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo,
                    // Re-send the metadata so a user who never finishes the
                    // first OTP and re-requests still ends up with a name set.
                    data: {
                        full_name: fullName.trim(),
                    },
                },
            });

            if (error) throw error;

            setMessage({
                type: 'success',
                text: 'Reenviamos el código a tu correo.',
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'No pudimos reenviar el código',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8">
            <h1 className="sr-only">Crear cuenta en RutaCero</h1>
            {/* Logo - Only visible on mobile */}
            <div className="flex justify-center lg:hidden">
                <BrandLogo height={50} priority />
            </div>

            <Card className="border-slate-200 bg-white/90 backdrop-blur-xl shadow-xl">
                <CardHeader className="space-y-1 pb-4 sm:pb-6">
                    <CardTitle className="text-xl sm:text-2xl text-slate-900">Crear cuenta</CardTitle>
                    <CardDescription className="text-sm sm:text-base text-slate-500">
                        {step === 'email' && 'Es gratis. Solo necesitas tu email para empezar y luego cargas tus deudas con calma.'}
                        {step === 'verify' && 'Ingresa el código de 6 dígitos que enviamos a tu correo.'}
                        {step === 'password' && 'Define una contraseña para iniciar sesión más adelante.'}
                    </CardDescription>
                </CardHeader>
                <form
                    onSubmit={
                        step === 'email'
                            ? handleSendOtp
                            : step === 'verify'
                                ? handleVerifyOtp
                                : handleSetPassword
                    }
                >
                    <CardContent className="space-y-4">
                        {step === 'email' && (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-600">
                                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <span>Registro pensado para confianza</span>
                                </div>
                                <p>
                                    Verificamos tu correo, no pedimos banca en línea y puedes empezar con
                                    el plan gratis antes de evaluar PRO.
                                </p>
                            </div>
                        )}

                        {step === 'email' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="fullName" className="text-sm sm:text-base text-slate-700">Nombre</Label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            id="fullName"
                                            type="text"
                                            autoComplete="name"
                                            placeholder="Ej. Ana López"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            required
                                            minLength={DISPLAY_NAME_MIN}
                                            maxLength={DISPLAY_NAME_MAX}
                                            aria-invalid={message?.type === 'error'}
                                            aria-describedby={message?.type === 'error' ? 'signup-error' : undefined}
                                            className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                </div>
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
                                            aria-invalid={message?.type === 'error'}
                                            aria-describedby={message?.type === 'error' ? 'signup-error' : undefined}
                                            className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {step === 'verify' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="otp" className="text-sm sm:text-base text-slate-700">Código de verificación</Label>
                                    <div className="relative">
                                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            id="otp"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            placeholder="123456"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            maxLength={6}
                                            required
                                            aria-invalid={message?.type === 'error'}
                                            aria-describedby={message?.type === 'error' ? 'signup-error' : undefined}
                                            className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    Enviado a <span className="text-slate-700">{email}</span>.{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep('email');
                                            setMessage(null);
                                        }}
                                        className="text-emerald-600 hover:text-emerald-500"
                                    >
                                        Cambiar email
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'password' && (
                            <>
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
                                            minLength={8}
                                            aria-invalid={message?.type === 'error'}
                                            aria-describedby={message?.type === 'error' ? 'signup-error' : undefined}
                                            className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>Seguridad</span>
                                            <span className={passwordStrength.textColor}>{passwordStrength.label}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${passwordStrength.barColor}`}
                                                style={{ width: `${passwordStrength.percent}%` }}
                                            />
                                        </div>
                                        <p
                                            className={`text-[11px] ${password.length > 0 && !passwordValid
                                                ? 'text-red-500'
                                                : 'text-slate-500'
                                                }`}
                                        >
                                            Usa al menos 8 caracteres. Mezcla mayúsculas, números o símbolos para reforzarla.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword" className="text-sm sm:text-base text-slate-700">Confirmar contraseña</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            aria-invalid={message?.type === 'error'}
                                            aria-describedby={message?.type === 'error' ? 'signup-error' : undefined}
                                            className="pl-10 h-11 sm:h-12 text-base bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {message && (
                            <div
                                id={message.type === 'error' ? 'signup-error' : undefined}
                                role={message.type === 'error' ? 'alert' : 'status'}
                                aria-live={message.type === 'error' ? 'assertive' : 'polite'}
                                className={`p-3 sm:p-4 rounded-lg text-sm ${message.type === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                    }`}
                            >
                                {message.text}
                            </div>
                        )}

                        {step === 'email' && (
                            <div className="space-y-2 sm:space-y-3 pt-2">
                                {[
                                    'Consolida todas tus deudas en un solo lugar',
                                    'Recibe un plan personalizado para salir de deudas',
                                    'Predicciones de flujo de caja quincenal',
                                ].map((benefit, i) => (
                                    <div key={i} className="flex items-start gap-2 sm:gap-3 text-sm text-slate-500">
                                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <span>{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {step === 'email' && (
                            <div className="pt-2">
                                <label
                                    htmlFor="accept-terms"
                                    className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer"
                                >
                                    <Checkbox
                                        id="accept-terms"
                                        required
                                        checked={acceptedTerms}
                                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                                        aria-describedby="accept-terms-description"
                                        containerClassName="mt-0.5"
                                    />
                                    <span id="accept-terms-description" className="leading-snug">
                                        He leído y acepto los{' '}
                                        <Link
                                            href="/terms"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-emerald-600 underline hover:text-emerald-500"
                                        >
                                            Términos
                                        </Link>{' '}
                                        y la{' '}
                                        <Link
                                            href="/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-emerald-600 underline hover:text-emerald-500"
                                        >
                                            Política de Privacidad
                                        </Link>{' '}
                                        de RutaCero. Entiendo que RutaCero es una herramienta de software y no presta servicios de asesoría financiera ni de intermediación bancaria.
                                    </span>
                                </label>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-2">
                        <Button
                            type="submit"
                            disabled={submitDisabled}
                            className="w-full h-11 sm:h-12 text-base bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white font-medium shadow-lg shadow-emerald-500/20 transition-all duration-200"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {step === 'email' && 'Enviando código...'}
                                    {step === 'verify' && 'Verificando...'}
                                    {step === 'password' && 'Guardando...'}
                                </>
                            ) : (
                                <>
                                    {step === 'email' && 'Enviar código'}
                                    {step === 'verify' && 'Verificar código'}
                                    {step === 'password' && 'Crear cuenta'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>

                        {step === 'verify' && (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={isLoading}
                                onClick={handleResendOtp}
                                className="text-slate-500 hover:text-slate-600"
                            >
                                Reenviar código
                            </Button>
                        )}

                        <p className="text-center text-sm text-slate-500">
                            ¿Ya tienes cuenta?{' '}
                            <Link
                                href="/login"
                                className="text-emerald-600 hover:text-emerald-500 transition-colors font-medium"
                            >
                                Inicia sesión
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>

            <DropoffCapture
                surface="signup"
                defaultEmail={email}
                className="border-slate-200 bg-white/80"
            />
        </div>
    );
}
