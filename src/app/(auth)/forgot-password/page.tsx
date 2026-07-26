'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ArrowLeft,
    CheckCircle,
    CircleNotch,
    Envelope
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
                        <h2 className="text-xl font-semibold text-white">¡Correo enviado!</h2>
                        <p className="text-slate-400">
                            <>Te enviamos un código a <span className="text-white font-medium">{email}</span> para restablecer tu contraseña.</>
                        </p>
                        <p className="text-slate-500 text-sm">
                            {'Revisá tu bandeja de entrada y spam. El código expira en unos minutos.'}
                        </p>
                    </CardContent>
                    <CardFooter className="pt-2">
                        <Link href="/login" className="w-full">
                            <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Volver al login
                            </Button>
                        </Link>
                    </CardFooter>
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
                        ¿Olvidaste tu contraseña?
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base text-slate-400">
                        Ingresa tu email y te enviaremos un enlace para restablecerla.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm sm:text-base text-slate-300">
                                Email
                            </Label>
                            <div className="relative">
                                <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
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
                    <CardFooter className="flex flex-col space-y-4 pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 sm:h-12 text-base bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium shadow-lg shadow-emerald-500/25"
                        >
                            {isLoading ? (
                                <>
                                    <CircleNotch {...ICON} className="w-4 h-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                'Enviar enlace'
                            )}
                        </Button>
                        <Link
                            href="/login"
                            className="text-center text-sm text-slate-400 hover:text-slate-300 flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver al login
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
