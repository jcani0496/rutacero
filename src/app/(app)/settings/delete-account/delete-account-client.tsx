'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleNotch, Trash, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    requestAccountDeletion,
    cancelAccountDeletion,
} from '@/lib/actions/account-deletion';
import { ICON } from '@/components/icons/phosphor';

interface PendingDeletion {
    id: string;
    executes_at: string;
    requested_at: string;
}

interface DeleteAccountClientProps {
    pending: PendingDeletion | null;
}

export function DeleteAccountClient({ pending }: DeleteAccountClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [reason, setReason] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (pending) {
        const executesDate = new Date(pending.executes_at);
        const formattedExecutes = new Intl.DateTimeFormat('es-GT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Guatemala',
        }).format(executesDate);

        const handleCancel = () => {
            setError(null);
            startTransition(async () => {
                const result = await cancelAccountDeletion();
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                router.refresh();
            });
        };

        return (
            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle className="text-destructive">
                        Solicitud de eliminacion activa
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Tu cuenta se eliminara el{' '}
                        <span className="font-medium text-foreground">
                            {formattedExecutes}
                        </span>
                        . Si cambiás de opinión, cancelá la solicitud antes de esa
                        fecha.
                    </p>

                    {error && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowCounterClockwise {...ICON} className="mr-2 h-4 w-4" />
                            )}
                            Cancelar solicitud
                        </Button>
                        <Button asChild variant="ghost">
                            <Link href="/settings">Volver a configuracion</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        if (!acknowledged) {
            setError(
                'Debes confirmar que entiendes que se eliminaran todos tus datos.'
            );
            return;
        }
        const trimmed = reason.trim();
        startTransition(async () => {
            const result = await requestAccountDeletion({
                reason: trimmed.length ? trimmed : null,
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <Card className="border-destructive/30">
            <CardHeader>
                <CardTitle className="text-destructive">
                    Zona peligrosa
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-2">
                        <Label htmlFor="reason">
                            Motivo (opcional)
                        </Label>
                        <Textarea
                            id="reason"
                            placeholder="Cuentanos por que te vas — nos ayuda a mejorar."
                            maxLength={1000}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Maximo 1000 caracteres.
                        </p>
                    </div>

                    <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                        <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(event) => setAcknowledged(event.target.checked)}
                            className="mt-1 h-4 w-4 cursor-pointer"
                            required
                        />
                        <span className="text-foreground">
                            Entiendo que esto eliminara permanentemente todos mis
                            datos (deudas, pagos, planes y configuracion) despues
                            del periodo de gracia de 7 dias.
                        </span>
                    </label>

                    {error && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={isPending || !acknowledged}
                        >
                            {isPending ? (
                                <>
                                    <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Trash {...ICON} className="mr-2 h-4 w-4" />
                                    Solicitar eliminacion
                                </>
                            )}
                        </Button>
                        <Button asChild variant="ghost">
                            <Link href="/settings">Cancelar</Link>
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Por seguridad, la eliminacion se ejecuta 7 dias despues de
                        confirmar la solicitud. Podés cancelar en cualquier momento
                        durante ese periodo iniciando sesion.
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}
