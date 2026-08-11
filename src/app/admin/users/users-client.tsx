'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users, MagnifyingGlass, Eye, CreditCard, Clock, Envelope, CalendarBlank, TrendUp, CircleNotch, Warning, UserCheck, Download, PencilSimple, UserPlus, Trash, ShieldCheck, ShieldSlash } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { UserListItem, UserDetails } from '@/lib/actions/admin-users';
import { createUser, deleteUser, getUserDetails, sendUserPasswordResetEmail, setUserBan, updateUser } from '@/lib/actions/admin-users';
import { toast } from '@/components/ui/toast';

interface UsersClientProps {
    users: UserListItem[];
    total: number;
    page: number;
    initialSearch: string;
}

type UserFormState = {
    email: string;
    displayName: string;
    password: string;
    emailConfirmed: boolean;
    onboardingCompleted: boolean;
    currencyBase: string;
    payFrequency: string;
    payDates: string;
    goalType: string;
    timezone: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    subscriptionProvider: string;
    subscriptionExternalId: string;
    subscriptionRenewAt: string;
    subscriptionCancelAt: string;
};

const DEFAULT_FORM_STATE: UserFormState = {
    email: '',
    displayName: '',
    password: '',
    emailConfirmed: false,
    onboardingCompleted: false,
    currencyBase: 'GTQ',
    payFrequency: 'BIWEEKLY',
    payDates: '15,30',
    goalType: 'BALANCED',
    timezone: 'America/Guatemala',
    subscriptionPlan: 'FREE',
    subscriptionStatus: 'ACTIVE',
    subscriptionProvider: 'internal',
    subscriptionExternalId: '',
    subscriptionRenewAt: '',
    subscriptionCancelAt: '',
};

const toDateInputValue = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
};

const toPayDatesInput = (value?: number[] | null) => {
    if (!value || value.length === 0) return '';
    return value.join(',');
};

const parsePayDates = (value: string) => {
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.trunc(entry));
};

export function UsersClient({ users, total, page, initialSearch }: UsersClientProps) {
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formState, setFormState] = useState<UserFormState>(DEFAULT_FORM_STATE);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
    const [banTarget, setBanTarget] = useState<{ id: string; email: string } | null>(null);
    const [banDuration, setBanDuration] = useState('24h');
    const [banError, setBanError] = useState<string | null>(null);
    const [unbanTarget, setUnbanTarget] = useState<{ id: string; email: string } | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (date: string | null) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatDateTime = (date: string | null) => {
        if (!date) return 'Nunca';
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isUserBanned = (bannedUntil: string | null) => {
        if (!bannedUntil) return false;
        return new Date(bannedUntil).getTime() > Date.now();
    };

    const openCreateModal = () => {
        setFormMode('create');
        setEditingUserId(null);
        setFormState(DEFAULT_FORM_STATE);
        setFormError(null);
        setFormSuccess(null);
        setIsFormOpen(true);
    };

    const openEditModal = (userId: string) => {
        setFormMode('edit');
        setFormError(null);
        setFormSuccess(null);
        startTransition(async () => {
            const details = await getUserDetails(userId);
            if (!details) return;

            const profile = details.profile;
            const subscription = details.subscription;

            setSelectedUser(details);
            setEditingUserId(userId);
            setFormState({
                email: details.email || '',
                displayName: details.display_name || '',
                password: '',
                emailConfirmed: details.email_confirmed,
                onboardingCompleted: details.onboarding_completed,
                currencyBase: profile?.currency_base || DEFAULT_FORM_STATE.currencyBase,
                payFrequency: profile?.pay_frequency || DEFAULT_FORM_STATE.payFrequency,
                payDates: toPayDatesInput(profile?.pay_dates) || DEFAULT_FORM_STATE.payDates,
                goalType: profile?.goal_type || DEFAULT_FORM_STATE.goalType,
                timezone: profile?.timezone || DEFAULT_FORM_STATE.timezone,
                subscriptionPlan: subscription?.plan_code || details.subscription_plan || DEFAULT_FORM_STATE.subscriptionPlan,
                subscriptionStatus: subscription?.status || DEFAULT_FORM_STATE.subscriptionStatus,
                subscriptionProvider: subscription?.provider || DEFAULT_FORM_STATE.subscriptionProvider,
                subscriptionExternalId: subscription?.external_id || '',
                subscriptionRenewAt: toDateInputValue(subscription?.renew_at),
                subscriptionCancelAt: toDateInputValue(subscription?.cancel_at),
            });
            setIsFormOpen(true);
        });
    };

    const handleViewDetails = (userId: string) => {
        startTransition(async () => {
            const details = await getUserDetails(userId);
            if (details) {
                setSelectedUser(details);
                setIsModalOpen(true);
            }
        });
    };

    const handleSaveUser = (event: FormEvent) => {
        event.preventDefault();
        setFormError(null);
        setFormSuccess(null);

        if (formMode === 'create' && !formState.password) {
            setFormError('La contraseña es requerida para crear el usuario');
            return;
        }

        const payload = {
            email: formState.email,
            display_name: formState.displayName,
            password: formState.password || undefined,
            email_confirmed: formState.emailConfirmed,
            profile: {
                currency_base: formState.currencyBase,
                pay_frequency: formState.payFrequency,
                pay_dates: parsePayDates(formState.payDates),
                goal_type: formState.goalType,
                timezone: formState.timezone,
                onboarding_completed: formState.onboardingCompleted,
            },
            subscription: {
                plan_code: formState.subscriptionPlan,
                status: formState.subscriptionStatus,
                provider: formState.subscriptionProvider,
                external_id: formState.subscriptionExternalId || null,
                renew_at: formState.subscriptionRenewAt || null,
                cancel_at: formState.subscriptionCancelAt || null,
            },
        };

        startTransition(async () => {
            if (formMode === 'create') {
                const result = await createUser(payload);
                if (!result.success) {
                    setFormError(result.error || 'No se pudo crear el usuario');
                    return;
                }
                setFormSuccess('Usuario creado correctamente');
            } else if (editingUserId) {
                const hadPassword = Boolean(formState.password.trim());
                const result = await updateUser(editingUserId, payload);
                if (!result.success) {
                    setFormError(result.error || 'No se pudo actualizar el usuario');
                    return;
                }
                setFormSuccess(
                    hadPassword
                        ? 'Usuario actualizado. Comunica la nueva contraseña al usuario por un canal seguro.'
                        : 'Usuario actualizado correctamente',
                );
            }

            setIsFormOpen(false);
            setFormState(DEFAULT_FORM_STATE);
            setEditingUserId(null);
            router.refresh();
        });
    };

    const handleSendPasswordResetEmail = () => {
        if (!editingUserId) return;
        setFormError(null);
        setFormSuccess(null);
        setIsSendingResetEmail(true);
        startTransition(async () => {
            const result = await sendUserPasswordResetEmail(editingUserId);
            setIsSendingResetEmail(false);
            if (!result.success) {
                setFormError(result.error || 'No se pudo enviar el correo');
                return;
            }
            setFormSuccess(result.message || 'Correo de restablecimiento enviado');
            toast.success(result.message || 'Correo de restablecimiento enviado');
        });
    };

    const handleDeleteUser = () => {
        if (!deleteTarget) return;
        setFormError(null);
        startTransition(async () => {
            const result = await deleteUser(deleteTarget.id);
            if (!result.success) {
                setFormError(result.error || 'No se pudo eliminar el usuario');
                return;
            }
            setDeleteTarget(null);
            setIsFormOpen(false);
            setEditingUserId(null);
            setFormState(DEFAULT_FORM_STATE);
            router.refresh();
        });
    };

    const handleConfirmBan = () => {
        if (!banTarget) return;
        setBanError(null);
        startTransition(async () => {
            const result = await setUserBan(banTarget.id, banDuration);
            if (!result.success) {
                setBanError(result.error || 'No se pudo bloquear al usuario');
                return;
            }
            toast.success(`Usuario bloqueado por ${banDuration}`);
            setBanTarget(null);
            router.refresh();
        });
    };

    const handleConfirmUnban = () => {
        if (!unbanTarget) return;
        startTransition(async () => {
            const result = await setUserBan(unbanTarget.id, 'none');
            if (!result.success) {
                toast.error(result.error || 'No se pudo desbloquear al usuario');
                return;
            }
            toast.success('Usuario desbloqueado');
            setUnbanTarget(null);
            router.refresh();
        });
    };

    const debtTypeLabels: Record<string, string> = {
        CREDIT_CARD: 'Tarjeta de Crédito',
        PERSONAL_LOAN: 'Préstamo Personal',
        AUTO_LOAN: 'Préstamo de Auto',
        MORTGAGE: 'Hipoteca',
        STUDENT_LOAN: 'Préstamo Estudiantil',
        MEDICAL: 'Deuda Médica',
        OTHER: 'Otro',
    };

    const handleExportCSV = async () => {
        const { exportUsersCSV } = await import('@/lib/actions/admin-export');
        startTransition(async () => {
            const csv = await exportUsersCSV();
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        });
    };

    return (
        <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Clientes</h1>
                    <p className="text-muted-foreground">
                        {total} cliente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        onClick={openCreateModal}
                        disabled={isLoading}
                    >
                        <UserPlus {...ICON} className="h-4 w-4 mr-2" />
                        Nuevo cliente
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <CircleNotch {...ICON} className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Download {...ICON} className="h-4 w-4 mr-2" />
                        )}
                        Exportar CSV
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <form className="flex gap-2">
                        <div className="relative flex-1">
                            <MagnifyingGlass {...ICON} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                name="search"
                                placeholder="Buscar por email o nombre..."
                                defaultValue={initialSearch}
                                className="pl-9"
                            />
                        </div>
                        <Button type="submit">Buscar</Button>
                    </form>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users {...ICON} className="h-5 w-5" />
                        Lista de Clientes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Registro</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No se encontraron usuarios
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => {
                                    const isBanned = isUserBanned(user.banned_until);
                                    return (
                                        <TableRow key={user.id}>
                                        <TableCell>
                                            <p className="font-medium">
                                                {user.display_name || 'Sin nombre'}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <Envelope {...ICON} className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="truncate max-w-[180px]">{user.email || 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {/* Email verification */}
                                                <div
                                                    className={`flex items-center justify-center w-6 h-6 rounded-full ${user.email_confirmed
                                                        ? 'bg-success/10 text-success'
                                                        : 'bg-warning/10 text-warning'
                                                        }`}
                                                    title={user.email_confirmed ? 'Email verificado' : 'Email sin verificar'}
                                                >
                                                    <Envelope {...ICON} className="h-3.5 w-3.5" />
                                                </div>
                                                {/* Onboarding */}
                                                <div
                                                    className={`flex items-center justify-center w-6 h-6 rounded-full ${user.onboarding_completed
                                                        ? 'bg-success/10 text-success'
                                                        : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    title={user.onboarding_completed ? 'Onboarding completado' : 'Onboarding pendiente'}
                                                >
                                                    <UserCheck {...ICON} className="h-3.5 w-3.5" />
                                                </div>
                                                {/* Activity */}
                                                <div
                                                    className={`flex items-center justify-center w-6 h-6 rounded-full ${user.is_active
                                                        ? 'bg-success/10 text-success'
                                                        : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    title={user.is_active ? 'Activo (últimos 30 días)' : 'Inactivo (+30 días)'}
                                                >
                                                    <Clock {...ICON} className="h-3.5 w-3.5" />
                                                </div>
                                                {/* Ban status */}
                                                <div
                                                    className={`flex items-center justify-center w-6 h-6 rounded-full ${isBanned
                                                        ? 'bg-destructive/10 text-destructive'
                                                        : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    title={isBanned ? 'Usuario bloqueado' : 'Sin bloqueo'}
                                                >
                                                    <ShieldSlash {...ICON} className="h-3.5 w-3.5" />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock {...ICON} className="h-3 w-3" />
                                                {formatDate(user.created_at)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {user.subscription_plan}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(user.id)}
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? (
                                                        <CircleNotch {...ICON} className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Eye {...ICON} className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditModal(user.id)}
                                                    disabled={isLoading}
                                                >
                                                    <PencilSimple {...ICON} className="h-4 w-4" />
                                                </Button>
                                                {isBanned ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setUnbanTarget({ id: user.id, email: user.email })}
                                                        disabled={isLoading}
                                                        title="Desbloquear usuario"
                                                    >
                                                        <ShieldCheck {...ICON} className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setBanTarget({ id: user.id, email: user.email })}
                                                        disabled={isLoading}
                                                        title="Bloquear usuario"
                                                    >
                                                        <ShieldSlash {...ICON} className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination placeholder */}
                    {total > 20 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <p className="text-sm text-muted-foreground">
                                Página {page} de {Math.ceil(total / 20)}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* User Details Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users {...ICON} className="h-5 w-5" />
                            Detalles del Usuario
                        </DialogTitle>
                        <DialogDescription>
                            Información completa del usuario
                        </DialogDescription>
                    </DialogHeader>

                    {/* Privacy Notice */}
                    <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm">
                        <Warning {...ICON} className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-warning">Datos Sensibles</p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                                Esta información es confidencial. El acceso ha sido registrado en el log de auditoría.
                            </p>
                        </div>
                    </div>

                    {selectedUser && (
                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Nombre</p>
                                    <p className="font-medium">{selectedUser.display_name || 'Sin nombre'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium flex items-center gap-1.5">
                                        <Envelope {...ICON} className="h-4 w-4 text-muted-foreground" />
                                        {selectedUser.email || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Fecha de Registro</p>
                                    <p className="font-medium flex items-center gap-1.5">
                                        <CalendarBlank {...ICON} className="h-4 w-4 text-muted-foreground" />
                                        {formatDateTime(selectedUser.created_at)}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Última Sesión</p>
                                    <p className="font-medium">{formatDateTime(selectedUser.last_sign_in_at)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Plan de Pago Activo</p>
                                    <Badge variant={selectedUser.plan_active ? 'success' : 'secondary'}>
                                        {selectedUser.plan_active ? 'Sí' : 'No'}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Suscripción</p>
                                    <Badge variant="outline">{selectedUser.subscription_plan}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Bloqueo</p>
                                    {isUserBanned(selectedUser.banned_until) ? (
                                        <Badge variant="destructive">
                                            Bloqueado hasta {formatDateTime(selectedUser.banned_until)}
                                        </Badge>
                                    ) : (
                                        <Badge variant="success">Activo</Badge>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2">
                                            <CreditCard {...ICON} className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Deudas</span>
                                        </div>
                                        <p className="mt-1 text-2xl font-bold">{selectedUser.debt_count}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2">
                                            <TrendUp {...ICON} className="h-5 w-5 text-warning" />
                                            <span className="text-sm text-muted-foreground">Total Deuda</span>
                                        </div>
                                        <p className="mt-1 text-2xl font-bold text-warning">
                                            {formatCurrency(selectedUser.total_debt)}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2">
                                            <Clock {...ICON} className="h-5 w-5 text-primary" />
                                            <span className="text-sm text-muted-foreground">Pagos</span>
                                        </div>
                                        <p className="mt-1 text-2xl font-bold">{selectedUser.payments_count}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Debts List */}
                            {selectedUser.debts.length > 0 && (
                                <div>
                                    <h3 className="font-medium mb-3">Deudas Activas</h3>
                                    <div className="space-y-2">
                                        {selectedUser.debts.map((debt) => (
                                            <div
                                                key={debt.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                            >
                                                <div>
                                                    <p className="font-medium">{debt.creditor}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {debtTypeLabels[debt.type] || debt.type}
                                                    </p>
                                                </div>
                                                <p className="font-medium text-warning">
                                                    {formatCurrency(debt.balance)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* User ID */}
                            <div className="pt-4 border-t">
                                <p className="text-xs text-muted-foreground">
                                    ID: <code className="px-1 py-0.5 bg-muted rounded">{selectedUser.id}</code>
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* User Create/Edit Modal */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {formMode === 'create' ? 'Crear usuario' : 'Editar usuario'}
                        </DialogTitle>
                        <DialogDescription>
                            {formMode === 'create'
                                ? 'Crea un usuario manualmente y configura su perfil.'
                                : 'Actualiza la informacion del usuario seleccionado.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveUser} className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Cuenta
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="admin-email">Email</Label>
                                    <Input
                                        id="admin-email"
                                        type="email"
                                        value={formState.email}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-display-name">Nombre</Label>
                                    <Input
                                        id="admin-display-name"
                                        value={formState.displayName}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, displayName: event.target.value }))}
                                        placeholder="Nombre visible"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-password">
                                        {formMode === 'create' ? 'Contraseña' : 'Nueva contraseña'}
                                    </Label>
                                    <Input
                                        id="admin-password"
                                        type="password"
                                        value={formState.password}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                                        placeholder={formMode === 'create' ? 'Minimo 8 caracteres' : 'Deja en blanco para no cambiar'}
                                        required={formMode === 'create'}
                                    />
                                    {formMode === 'edit' && editingUserId ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            onClick={handleSendPasswordResetEmail}
                                            disabled={isLoading || isSendingResetEmail}
                                        >
                                            {isSendingResetEmail ? (
                                                <CircleNotch {...ICON} className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Envelope {...ICON} className="h-4 w-4 mr-2" />
                                            )}
                                            Enviar correo de restablecimiento
                                        </Button>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <Label>Email confirmado</Label>
                                    <Select
                                        value={formState.emailConfirmed ? 'true' : 'false'}
                                        onValueChange={(value) => setFormState((prev) => ({ ...prev, emailConfirmed: value === 'true' }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Si</SelectItem>
                                            <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Onboarding completado</Label>
                                    <Select
                                        value={formState.onboardingCompleted ? 'true' : 'false'}
                                        onValueChange={(value) => setFormState((prev) => ({ ...prev, onboardingCompleted: value === 'true' }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Si</SelectItem>
                                            <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Perfil financiero
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Moneda base</Label>
                                    <Select
                                        value={formState.currencyBase}
                                        onValueChange={(value) => setFormState((prev) => ({ ...prev, currencyBase: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GTQ">Quetzales (GTQ)</SelectItem>
                                            <SelectItem value="USD">Dolares (USD)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Solo se puede cambiar si el usuario no tiene deudas, pagos, ingresos, gastos ni presupuestos.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Frecuencia de pago</Label>
                                    <Select
                                        value={formState.payFrequency}
                                        onValueChange={(value) => setFormState((prev) => ({
                                            ...prev,
                                            payFrequency: value,
                                            payDates: value === 'VARIABLE' ? '' : (prev.payDates || DEFAULT_FORM_STATE.payDates),
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                                            <SelectItem value="MONTHLY">Mensual</SelectItem>
                                            <SelectItem value="VARIABLE">Variable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="admin-pay-dates">Dias de pago (comma separados)</Label>
                                    <Input
                                        id="admin-pay-dates"
                                        value={formState.payDates}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, payDates: event.target.value }))}
                                        placeholder="15,30"
                                        disabled={formState.payFrequency === 'VARIABLE'}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Usa numeros del 1 al 31. Ejemplo: 15,30.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Objetivo</Label>
                                    <Select
                                        value={formState.goalType}
                                        onValueChange={(value) => setFormState((prev) => ({ ...prev, goalType: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FASTEST">Mas rapido</SelectItem>
                                            <SelectItem value="LEAST_INTEREST">Menor interes</SelectItem>
                                            <SelectItem value="BALANCED">Balanceado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-timezone">Zona horaria</Label>
                                    <Input
                                        id="admin-timezone"
                                        value={formState.timezone}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, timezone: event.target.value }))}
                                        placeholder="America/Guatemala"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Suscripcion
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Plan</Label>
                                    <Select
                                        value={formState.subscriptionPlan}
                                        onValueChange={(value) => setFormState((prev) => ({ ...prev, subscriptionPlan: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FREE">Free</SelectItem>
                                            <SelectItem value="PRO">Pro</SelectItem>
                                            <SelectItem value="BUSINESS">Business</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Estado</Label>
                                    <Select
                                        value={formState.subscriptionStatus}
                                        onValueChange={(value) => setFormState((prev) => ({ ...prev, subscriptionStatus: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TRIAL">Trial</SelectItem>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                            <SelectItem value="PAST_DUE">Past due</SelectItem>
                                            <SelectItem value="CANCELED">Canceled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-provider">Proveedor</Label>
                                    <Input
                                        id="admin-provider"
                                        value={formState.subscriptionProvider}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, subscriptionProvider: event.target.value }))}
                                        placeholder="internal"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-external-id">External ID</Label>
                                    <Input
                                        id="admin-external-id"
                                        value={formState.subscriptionExternalId}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, subscriptionExternalId: event.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-renew-at">Renueva el</Label>
                                    <Input
                                        id="admin-renew-at"
                                        type="date"
                                        value={formState.subscriptionRenewAt}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, subscriptionRenewAt: event.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-cancel-at">Cancela el</Label>
                                    <Input
                                        id="admin-cancel-at"
                                        type="date"
                                        value={formState.subscriptionCancelAt}
                                        onChange={(event) => setFormState((prev) => ({ ...prev, subscriptionCancelAt: event.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {formError && (
                            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {formError}
                            </div>
                        )}
                        {formSuccess && (
                            <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                                {formSuccess}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {formMode === 'edit' && editingUserId ? (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => setDeleteTarget({ id: editingUserId, email: formState.email })}
                                    disabled={isLoading}
                                >
                                    <Trash {...ICON} className="h-4 w-4 mr-2" />
                                    Eliminar usuario
                                </Button>
                            ) : (
                                <div />
                            )}

                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsFormOpen(false)}
                                    disabled={isLoading}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? (
                                        <CircleNotch {...ICON} className="h-4 w-4 mr-2 animate-spin" />
                                    ) : null}
                                    {formMode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Ban User */}
            <Dialog
                open={!!banTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setBanTarget(null);
                        setBanError(null);
                        setBanDuration('24h');
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Bloquear usuario</DialogTitle>
                        <DialogDescription>
                            Selecciona por cuánto tiempo deseas bloquear a este usuario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Duración del bloqueo</Label>
                            <Select value={banDuration} onValueChange={setBanDuration}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="24h">24 horas</SelectItem>
                                    <SelectItem value="72h">3 días</SelectItem>
                                    <SelectItem value="168h">7 días</SelectItem>
                                    <SelectItem value="720h">30 días</SelectItem>
                                    <SelectItem value="8760h">1 año</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {banError && (
                            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {banError}
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setBanTarget(null)}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleConfirmBan}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <CircleNotch {...ICON} className="h-4 w-4 mr-2 animate-spin" />
                                ) : null}
                                Bloquear usuario
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unban Confirmation */}
            <AlertDialog open={!!unbanTarget} onOpenChange={(open) => !open && setUnbanTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desbloquear usuario</AlertDialogTitle>
                        <AlertDialogDescription>
                            Este usuario podrá iniciar sesión nuevamente en la plataforma.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmUnban} disabled={isLoading}>
                            {isLoading ? (
                                <CircleNotch {...ICON} className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Desbloquear
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta accion elimina la cuenta y toda la informacion asociada. No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteUser}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <CircleNotch {...ICON} className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Eliminar definitivamente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
