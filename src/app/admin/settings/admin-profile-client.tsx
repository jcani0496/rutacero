'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleNotch, PencilSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateAdminProfile } from '@/lib/actions/admin-profile';

interface AdminProfileClientProps {
    initialDisplayName: string;
    initialEmail: string;
}

export function AdminProfileClient({ initialDisplayName, initialEmail }: AdminProfileClientProps) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [email, setEmail] = useState(initialEmail);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const resetForm = () => {
        setDisplayName(initialDisplayName);
        setEmail(initialEmail);
        setError(null);
        setMessage(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        startTransition(async () => {
            const result = await updateAdminProfile({ displayName, email });
            if (!result.success) {
                setError(result.error || 'No se pudo guardar el perfil');
                return;
            }

            setMessage('Perfil actualizado');
            setEditing(false);
            router.refresh();
        });
    };

    if (!editing) {
        return (
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    resetForm();
                    setEditing(true);
                }}
            >
                <PencilSimple className="mr-2 h-4 w-4" />
                Editar perfil
            </Button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
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
                <Label htmlFor="admin-display-name">Nombre</Label>
                <Input
                    id="admin-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isPending}
                    autoComplete="name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isPending}
                    autoComplete="email"
                />
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                    {isPending ? (
                        <>
                            <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        'Guardar perfil'
                    )}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => {
                        resetForm();
                        setEditing(false);
                    }}
                >
                    Cancelar
                </Button>
            </div>
        </form>
    );
}
