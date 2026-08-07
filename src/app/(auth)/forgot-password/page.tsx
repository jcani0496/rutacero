'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft,
    CheckCircle,
    CircleNotch,
    Envelope,
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email,
                type: 'forget-password',
            });
            if (error) throw new Error(error.message || 'Error al enviar el código');
            setSent(true);
            window.location.assign(
                `/reset-password?email=${encodeURIComponent(email)}&mode=otp`,
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al enviar el correo');
        } finally {
            setIsLoading(false);
        }
    };

    if (sent) {
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
                        Código enviado
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Te enviamos un código a{' '}
                        <span className="font-medium text-foreground">{email}</span> para
                        restablecer tu contraseña.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Revisa tu bandeja de entrada y spam. El código expira en unos minutos.
                    </p>
                </div>

                <Button variant="outline" className="h-11 w-full sm:h-12" asChild>
                    <Link href="/login">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al login
                    </Link>
                </Button>
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
                    ¿Olvidaste tu contraseña?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Ingresa tu email y te enviaremos un código para restablecerla.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                            Enviando...
                        </>
                    ) : (
                        'Enviar código'
                    )}
                </Button>

                <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al login
                </Link>
            </form>
        </div>
    );
}
