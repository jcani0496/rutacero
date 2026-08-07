'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
                        <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <p className="overline">Acceso restringido</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        Panel de Administración
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        RutaCero · Solo personal autorizado
                    </p>
                </div>

                <Card className="rounded-xl shadow-none">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <WarningCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@rutacero.gt"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
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
                                />
                                <p className="text-xs text-muted-foreground">
                                    Opcional hasta que actives MFA en Configuración → Tu cuenta.
                                </p>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <>
                                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                                        Ingresando...
                                    </>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    Toda actividad queda registrada en el log de auditoría.
                </p>
            </div>
        </div>
    );
}
