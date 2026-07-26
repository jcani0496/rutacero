'use client';

import { useState, useTransition } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { setAdminMfaEnabled } from '@/lib/actions/admin-auth';

type Props = {
    initialEnabled: boolean;
    secretConfigured: boolean;
};

export function AdminMfaClient({ initialEnabled, secretConfigured }: Props) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleEnable = () => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const result = await setAdminMfaEnabled(true, code);
            if (!result.success) {
                setError(result.error || 'No se pudo activar MFA');
                return;
            }
            setEnabled(true);
            setCode('');
            setMessage('MFA activado. En el próximo login te pedirá el código.');
        });
    };

    const handleDisable = () => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const result = await setAdminMfaEnabled(false);
            if (!result.success) {
                setError(result.error || 'No se pudo desactivar MFA');
                return;
            }
            setEnabled(false);
            setMessage('MFA desactivado. El login vuelve a ser solo con contraseña.');
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado MFA</span>
                <Badge variant={enabled ? 'default' : 'secondary'}>
                    {enabled ? 'Activo' : 'Inactivo (opcional)'}
                </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
                El MFA no se exige hasta que lo actives acá. Primero agregá el secreto del
                servidor en tu app autenticadora (Google Authenticator / Authy) y luego
                confirmá con un código de 6 dígitos.
            </p>

            {!secretConfigured && (
                <Alert variant="destructive">
                    <AlertDescription>
                        Falta <code className="text-xs">ADMIN_MFA_TOTP_SECRET</code> en el
                        entorno. No se puede activar MFA hasta configurarlo.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {message && (
                <Alert>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            {!enabled ? (
                <div className="space-y-3 max-w-sm">
                    <div className="space-y-2">
                        <Label htmlFor="admin-mfa-code">Código del autenticador</Label>
                        <Input
                            id="admin-mfa-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="123456"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            disabled={!secretConfigured || isPending}
                        />
                    </div>
                    <Button
                        type="button"
                        onClick={handleEnable}
                        disabled={!secretConfigured || isPending || code.trim().length < 6}
                    >
                        {isPending ? (
                            <>
                                <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                                Activando…
                            </>
                        ) : (
                            'Activar MFA'
                        )}
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisable}
                    disabled={isPending}
                >
                    {isPending ? (
                        <>
                            <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        'Desactivar MFA'
                    )}
                </Button>
            )}
        </div>
    );
}
