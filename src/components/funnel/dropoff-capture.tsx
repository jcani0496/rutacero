'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DROPOFF_SURFACE_CONFIG, type DropoffSurface } from '@/lib/funnel/dropoff';

interface DropoffCaptureProps {
    surface: DropoffSurface;
    className?: string;
    defaultOpen?: boolean;
    defaultEmail?: string;
    title?: string;
    description?: string;
    triggerLabel?: string;
}

export function DropoffCapture({
    surface,
    className,
    defaultOpen = false,
    defaultEmail = '',
    title,
    description,
    triggerLabel,
}: DropoffCaptureProps) {
    const config = DROPOFF_SURFACE_CONFIG[surface];
    const [open, setOpen] = useState(defaultOpen);
    const [reason, setReason] = useState('');
    const [detail, setDetail] = useState('');
    const [email, setEmail] = useState(defaultEmail);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const resolvedTitle = title || config.title;
    const resolvedDescription = description || config.description;
    const resolvedTriggerLabel = triggerLabel || config.triggerLabel;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!reason) {
            setError('Selecciona el motivo principal.');
            return;
        }

        setIsSubmitting(true);

        try {
            const path = typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}`
                : undefined;

            const response = await fetch('/api/funnel/dropoff', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    surface,
                    reason,
                    detail: detail.trim() || undefined,
                    email: email.trim() || undefined,
                    path,
                }),
            });

            if (!response.ok) {
                throw new Error('No pudimos guardar tu respuesta.');
            }

            setSubmitted(true);
            setReason('');
            setDetail('');
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : 'No pudimos guardar tu respuesta.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={cn('rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm', className)}>
            {submitted ? (
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-semibold text-foreground">{config.successTitle}</p>
                        <p className="text-sm text-muted-foreground">{config.successDescription}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <MessageSquareWarning className="h-4 w-4 text-amber-500" />
                                <span>{resolvedTitle}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
                        </div>
                        {!open && (
                            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                                {resolvedTriggerLabel}
                            </Button>
                        )}
                    </div>

                    {open && (
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor={`${surface}-reason`}>Motivo principal</Label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger id={`${surface}-reason`} className="h-11">
                                        <SelectValue placeholder="Selecciona una opcion" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {config.reasons.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`${surface}-detail`}>Detalle opcional</Label>
                                <Textarea
                                    id={`${surface}-detail`}
                                    value={detail}
                                    onChange={(event) => setDetail(event.target.value)}
                                    placeholder="Si quieres, cuentanos un poco mas."
                                    className="min-h-24 bg-background"
                                    maxLength={500}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`${surface}-email`}>Correo opcional</Label>
                                <Input
                                    id={`${surface}-email`}
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="tu@email.com"
                                    className="h-11 bg-background"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Solo si quieres que te contactemos para entender mejor el caso.
                                </p>
                            </div>

                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button type="submit" disabled={isSubmitting} className="sm:flex-1">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        config.submitLabel
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Ahora no
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
