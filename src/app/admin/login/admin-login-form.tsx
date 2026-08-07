'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { adminLogin } from '@/lib/actions/admin-auth';

export default function AdminLoginForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        startTransition(async () => {
            const result = await adminLogin(email, password, mfaCode);

            if (result.success) {
                router.replace('/admin/dashboard');
            } else {
                setError(result.error || 'Error al iniciar sesión');
            }
        });
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
            <div className="w-full max-w-md">
                <div className="mb-10">
                    <BrandLogo height={40} priority variant="light" />
                    <p className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">
                        Acceso restringido
                    </p>
                    <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Panel de administración
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Solo personal autorizado. Toda actividad queda en el log de auditoría.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <Alert variant="destructive">
                            <WarningCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@rutacero.gt"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11 bg-card sm:h-12"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="h-11 bg-card sm:h-12"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="mfaCode">Código MFA</Label>
                        <Input
                            id="mfaCode"
                            type="text"
                            inputMode="numeric"
                            placeholder="Solo si ya activaste MFA"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            autoComplete="one-time-code"
                            className="h-11 bg-card sm:h-12"
                        />
                        <p className="text-xs text-muted-foreground">
                            Opcional hasta que actives MFA en Configuración → Tu cuenta.
                        </p>
                    </div>

                    <Button type="submit" className="h-11 w-full text-base sm:h-12" disabled={isPending}>
                        {isPending ? (
                            <>
                                <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                                Ingresando...
                            </>
                        ) : (
                            'Iniciar sesión'
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
