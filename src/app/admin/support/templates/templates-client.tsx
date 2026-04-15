'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableEmpty,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import type { ReplyTemplate } from '@/lib/actions/admin-support';
import {
    createReplyTemplate,
    deleteReplyTemplate,
    updateReplyTemplate,
} from '@/lib/actions/admin-support';

interface TemplatesClientProps {
    templates: ReplyTemplate[];
    canManage: boolean;
}

type TemplateFormState = {
    title: string;
    body: string;
    isActive: boolean;
};

const DEFAULT_FORM: TemplateFormState = {
    title: '',
    body: '',
    isActive: true,
};

export function TemplatesClient({ templates, canManage }: TemplatesClientProps) {
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formState, setFormState] = useState<TemplateFormState>(DEFAULT_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const filtered = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        if (!searchLower) return templates;
        return templates.filter((template) =>
            template.title.toLowerCase().includes(searchLower)
            || template.body.toLowerCase().includes(searchLower)
        );
    }, [templates, search]);

    const openCreate = () => {
        setFormMode('create');
        setFormState(DEFAULT_FORM);
        setEditingId(null);
        setIsDialogOpen(true);
    };

    const openEdit = (template: ReplyTemplate) => {
        setFormMode('edit');
        setEditingId(template.id);
        setFormState({
            title: template.title,
            body: template.body,
            isActive: template.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        startTransition(async () => {
            if (formMode === 'create') {
                const result = await createReplyTemplate({
                    title: formState.title,
                    body: formState.body,
                    is_active: formState.isActive,
                });
                if (!result.success) {
                    toast.error(result.error || 'No se pudo crear la plantilla.');
                    return;
                }
                toast.success('Plantilla creada.');
                setIsDialogOpen(false);
                window.location.reload();
                return;
            }

            if (!editingId) return;
            const result = await updateReplyTemplate({
                id: editingId,
                title: formState.title,
                body: formState.body,
                is_active: formState.isActive,
            });
            if (!result.success) {
                toast.error(result.error || 'No se pudo actualizar la plantilla.');
                return;
            }
            toast.success('Plantilla actualizada.');
            setIsDialogOpen(false);
            window.location.reload();
        });
    };

    const handleDelete = (template: ReplyTemplate) => {
        if (!confirm(`Eliminar la plantilla "${template.title}"?`)) {
            return;
        }
        startTransition(async () => {
            const result = await deleteReplyTemplate(template.id);
            if (!result.success) {
                toast.error(result.error || 'No se pudo eliminar la plantilla.');
                return;
            }
            toast.success('Plantilla eliminada.');
            window.location.reload();
        });
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Plantillas de respuesta</h1>
                    <p className="text-muted-foreground">
                        Macros rápidas para respuestas y notas internas.
                    </p>
                </div>
                {canManage && (
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva plantilla
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Plantillas
                    </CardTitle>
                    <CardDescription>
                        Administra el contenido disponible para el equipo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex min-w-[240px] flex-1 flex-col gap-2">
                        <Label htmlFor="template-search">Buscar</Label>
                        <Input
                            id="template-search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por título o contenido"
                        />
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Actualizado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableEmpty
                                    title="Sin plantillas"
                                    description="Crea la primera macro para tu equipo."
                                />
                            ) : (
                                filtered.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">
                                            <div>{template.title}</div>
                                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                {template.body}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            {template.is_active ? (
                                                <Badge variant="success">Activa</Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactiva</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(template.updated_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEdit(template)}
                                                    disabled={!canManage}
                                                >
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(template)}
                                                    disabled={!canManage}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {formMode === 'create' ? 'Nueva plantilla' : 'Editar plantilla'}
                        </DialogTitle>
                        <DialogDescription>
                            Define textos reutilizables para el equipo de soporte.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Título</Label>
                            <Input
                                value={formState.title}
                                onChange={(event) => setFormState((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                }))}
                                placeholder="Confirmación de pago"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Contenido</Label>
                            <Textarea
                                value={formState.body}
                                onChange={(event) => setFormState((prev) => ({
                                    ...prev,
                                    body: event.target.value,
                                }))}
                                rows={6}
                                placeholder="Hola, ya hemos revisado tu solicitud..."
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div>
                                <p className="text-sm font-medium">Estado</p>
                                <p className="text-xs text-muted-foreground">
                                    {formState.isActive ? 'Activa' : 'Inactiva'}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant={formState.isActive ? 'outline' : 'secondary'}
                                size="sm"
                                onClick={() => setFormState((prev) => ({
                                    ...prev,
                                    isActive: !prev.isActive,
                                }))}
                            >
                                {formState.isActive ? 'Desactivar' : 'Activar'}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={isPending || !canManage}>
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando
                                </>
                            ) : (
                                'Guardar'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
