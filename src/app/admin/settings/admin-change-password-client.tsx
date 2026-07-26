'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { changeAdminPassword } from '@/lib/actions/admin-auth';

const MIN_PASSWORD_LENGTH = 8;

export function AdminChangePasswordClient() {
    const [open, setOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const resetFields = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const isFormValid =
        currentPassword.length > 0 &&
        newPassword.length >= MIN_PASSWORD_LENGTH &&
        confirmPassword.length > 0 &&
        newPassword === confirmPassword;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas nuevas no coinciden');
            return;
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
            return;
        }

        startTransition(async () => {
            const result = await changeAdminPassword(currentPassword, newPassword);
            if (!result.success) {
                setError(result.error || 'No se pudo cambiar la contraseña');
                return;
            }
            resetFields();
            setMessage('Contraseña actualizada correctamente');
            setOpen(false);
        });
    };

    if (!open) {
        return (
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    setError(null);
                    setMessage(null);
                    setOpen(true);
                }}
            >
                Cambiar Contraseña
            </Button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
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

            <div className="space-y-2">
                <Label htmlFor="admin-current-password">Contraseña actual</Label>
                <Input
                    id="admin-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={isPending}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="admin-new-password">Contraseña nueva</Label>
                <Input
                    id="admin-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isPending}
                    hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirmar contraseña nueva</Label>
                <Input
                    id="admin-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isPending}
                />
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={!isFormValid || isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        'Guardar contraseña'
                    )}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => {
                        resetFields();
                        setError(null);
                        setMessage(null);
                        setOpen(false);
                    }}
                >
                    Cancelar
                </Button>
            </div>
        </form>
    );
}
