'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Plus, Pencil, UserX, UserCheck, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import type { AdminRole } from '@/lib/actions/admin-auth';
import type { StaffUser } from '@/lib/actions/admin-staff';
import {
    createAdminStaff,
    resetAdminStaffPassword,
    updateAdminStaff,
} from '@/lib/actions/admin-staff';

interface StaffClientProps {
    staff: StaffUser[];
    initialSearch: string;
}

type StaffFormState = {
    email: string;
    displayName: string;
    role: AdminRole;
    password: string;
    isActive: boolean;
};

const DEFAULT_FORM: StaffFormState = {
    email: '',
    displayName: '',
    role: 'SUPPORT',
    password: '',
    isActive: true,
};

const ROLE_LABELS: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    SUPPORT: 'Soporte',
    ANALYST: 'Analista',
};

export function StaffClient({ staff, initialSearch }: StaffClientProps) {
    const router = useRouter();
    const [search, setSearch] = useState(initialSearch);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formState, setFormState] = useState<StaffFormState>(DEFAULT_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const filtered = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        if (!searchLower) return staff;
        return staff.filter((member) =>
            member.email.toLowerCase().includes(searchLower)
            || (member.display_name || '').toLowerCase().includes(searchLower)
        );
    }, [staff, search]);

    const openCreate = () => {
        setFormMode('create');
        setFormState(DEFAULT_FORM);
        setEditingId(null);
        setIsDialogOpen(true);
    };

    const openEdit = (member: StaffUser) => {
        setFormMode('edit');
        setEditingId(member.id);
        setFormState({
            email: member.email,
            displayName: member.display_name || '',
            role: member.role,
            password: '',
            isActive: member.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        startTransition(async () => {
            if (formMode === 'create') {
                const result = await createAdminStaff({
                    email: formState.email,
                    displayName: formState.displayName,
                    role: formState.role,
                    password: formState.password,
                });
                if (!result.success) {
                    toast.error(result.error || 'No se pudo crear el usuario.');
                    return;
                }
                toast.success('Usuario creado.');
                setIsDialogOpen(false);
                router.refresh();
                return;
            }

            if (!editingId) return;
            const updateResult = await updateAdminStaff({
                id: editingId,
                displayName: formState.displayName,
                role: formState.role,
                isActive: formState.isActive,
            });
            if (!updateResult.success) {
                toast.error(updateResult.error || 'No se pudo actualizar el usuario.');
                return;
            }

            if (formState.password.trim()) {
                const passwordResult = await resetAdminStaffPassword({
                    id: editingId,
                    password: formState.password,
                });
                if (!passwordResult.success) {
                    toast.error(passwordResult.error || 'No se pudo actualizar la contraseña.');
                    return;
                }
            }

            toast.success('Usuario actualizado.');
            setIsDialogOpen(false);
            router.refresh();
        });
    };

    const formatDate = (date: string | null) => {
        if (!date) return 'Sin registro';
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Personal RutaCero</h1>
                    <p className="text-muted-foreground">
                        Gestiona los accesos del equipo de backoffice.
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo miembro
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Equipo
                    </CardTitle>
                    <CardDescription>
                        Roles internos y estado de acceso.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex min-w-[240px] flex-1 flex-col gap-2">
                            <Label htmlFor="staff-search">Buscar</Label>
                            <Input
                                id="staff-search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Email o nombre"
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Último acceso</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableEmpty
                                    title="No hay registros"
                                    description="No se encontraron miembros con esos filtros."
                                />
                            ) : (
                                filtered.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">
                                            {member.display_name || 'Sin nombre'}
                                        </TableCell>
                                        <TableCell>{member.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {ROLE_LABELS[member.role]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {member.is_active ? (
                                                <Badge variant="success">Activo</Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactivo</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(member.last_login_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEdit(member)}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Editar
                                            </Button>
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
                            {formMode === 'create' ? 'Nuevo miembro' : 'Editar miembro'}
                        </DialogTitle>
                        <DialogDescription>
                            {formMode === 'create'
                                ? 'Crea un nuevo usuario del equipo.'
                                : 'Actualiza datos y permisos.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                value={formState.email}
                                onChange={(event) => setFormState((prev) => ({
                                    ...prev,
                                    email: event.target.value,
                                }))}
                                placeholder="correo@rutacero.gt"
                                disabled={formMode === 'edit'}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                                value={formState.displayName}
                                onChange={(event) => setFormState((prev) => ({
                                    ...prev,
                                    displayName: event.target.value,
                                }))}
                                placeholder="Nombre del miembro"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol</Label>
                            <Select
                                value={formState.role}
                                onValueChange={(value) => setFormState((prev) => ({
                                    ...prev,
                                    role: value as AdminRole,
                                }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                    <SelectItem value="ADMIN">Administrador</SelectItem>
                                    <SelectItem value="SUPPORT">Soporte</SelectItem>
                                    <SelectItem value="ANALYST">Analista</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{formMode === 'create' ? 'Contraseña' : 'Nueva contraseña'}</Label>
                            <Input
                                type="password"
                                value={formState.password}
                                onChange={(event) => setFormState((prev) => ({
                                    ...prev,
                                    password: event.target.value,
                                }))}
                                placeholder={formMode === 'create' ? '********' : 'Dejar vacío para no cambiar'}
                            />
                        </div>
                        {formMode === 'edit' && (
                            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium">Estado</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formState.isActive ? 'Activo' : 'Inactivo'}
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
                                    {formState.isActive ? (
                                        <>
                                            <UserX className="mr-2 h-4 w-4" />
                                            Desactivar
                                        </>
                                    ) : (
                                        <>
                                            <UserCheck className="mr-2 h-4 w-4" />
                                            Activar
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={isPending}>
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
