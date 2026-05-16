'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { updateDisplayName } from '@/lib/actions/profile';

interface DisplayNameEditorProps {
    /** The current display name, already derived via getDisplayName. */
    initialName: string;
}

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;

/**
 * Inline editor for the user's display name. Click "Editar" to swap the
 * static label for an input + save/cancel buttons. The save action goes
 * through a server action that revalidates the layout so the header and
 * sidebar pick up the new name without a manual reload.
 */
export function DisplayNameEditor({ initialName }: DisplayNameEditorProps) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(initialName);
    const [committedName, setCommittedName] = useState(initialName);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const startEditing = () => {
        setValue(committedName);
        setError(null);
        setEditing(true);
    };

    const cancel = () => {
        setEditing(false);
        setError(null);
        setValue(committedName);
    };

    const save = () => {
        const trimmed = value.trim();
        if (trimmed.length < DISPLAY_NAME_MIN) {
            setError('Mínimo 2 caracteres.');
            return;
        }
        if (trimmed.length > DISPLAY_NAME_MAX) {
            setError(`Máximo ${DISPLAY_NAME_MAX} caracteres.`);
            return;
        }
        setError(null);

        startTransition(async () => {
            // Belt-and-suspenders: React 19's useTransition silently swallows
            // rejected async callbacks, so if the action throws despite its
            // internal try/catch, we still surface it to the user.
            try {
                const result = await updateDisplayName({ fullName: trimmed });
                if (!result.success) {
                    const message = result.error || 'No se pudo guardar.';
                    setError(message);
                    toast.error(message);
                    return;
                }
                setCommittedName(trimmed);
                setEditing(false);
                toast.success('Nombre actualizado.');
            } catch (err) {
                console.error('[display-name-editor] save failed:', err);
                const message = 'Error inesperado al guardar. Intenta de nuevo.';
                setError(message);
                toast.error(message);
            }
        });
    };

    if (!editing) {
        return (
            <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nombre</p>
                <div className="flex items-center gap-2">
                    <p className="font-medium">{committedName}</p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={startEditing}
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        aria-label="Editar nombre"
                    >
                        <Pencil className="size-3" aria-hidden="true" />
                        Editar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form
            className="space-y-1"
            onSubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            <Label htmlFor="display-name-editor-input" className="text-sm text-muted-foreground">
                Nombre
            </Label>
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    id="display-name-editor-input"
                    type="text"
                    autoComplete="name"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    minLength={DISPLAY_NAME_MIN}
                    maxLength={DISPLAY_NAME_MAX}
                    required
                    autoFocus
                    disabled={isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'display-name-editor-error' : undefined}
                    className="h-9 max-w-xs"
                />
                <Button
                    type="submit"
                    size="sm"
                    disabled={isPending}
                    className="gap-1"
                >
                    {isPending ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <Check className="size-3" aria-hidden="true" />
                    )}
                    Guardar
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={cancel}
                    disabled={isPending}
                    className="gap-1 text-muted-foreground"
                >
                    <X className="size-3" aria-hidden="true" />
                    Cancelar
                </Button>
            </div>
            {error ? (
                <p id="display-name-editor-error" role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            ) : null}
        </form>
    );
}
