'use client';

import { useEffect, useState, useTransition } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import {
    User as UserIcon,
    CreditCard,
    LogOut,
    Save,
    Loader2,
    Crown,
    AlertTriangle,
    ShieldCheck,
    KeyRound,
    Trash2,
    Download,
} from 'lucide-react';
import { exportRawDebts, exportRawPayments } from '@/lib/actions/export';
import { updateDisplayName } from '@/lib/actions/profile';
import { getDisplayName } from '@/lib/auth/display-name';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SettingsClientProps {
    user: User;
    profile: {
        id: string;
        user_id: string;
        display_name?: string;
        currency_base?: string;
        cutoff_day?: number;
        goal_type?: string;
        motivation_level?: number;
        risk_tolerance?: number;
        safety_buffer_pct?: number;
        created_at?: string;
    } | null;
    subscription?: {
        id: string;
        plan_code: string;
        status: string;
        provider?: string | null;
        renew_at?: string | null;
        external_id?: string | null;
    } | null;
}

export function SettingsClient({ user, profile, subscription }: SettingsClientProps) {
    type SupabaseClientType = ReturnType<typeof createClient>;
    type MfaFactors = Awaited<ReturnType<SupabaseClientType['auth']['mfa']['listFactors']>>['data'];

    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);
    const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);
    const [mfaFactors, setMfaFactors] = useState<MfaFactors | null>(null);
    const [enrollData, setEnrollData] = useState<{ id: string; qrCode: string; secret: string } | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [isExportingDebts, setIsExportingDebts] = useState(false);
    const [isExportingPayments, setIsExportingPayments] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    // Form state.
    // Display name lives in auth.user_metadata.full_name (the canonical key per
    // src/lib/auth/display-name.ts), NOT in a user_profiles column. user_profiles
    // has no display_name column — previous code silently failed because the
    // update rejected with "column does not exist" and the catch only logged
    // to console.
    const initialDisplayName = (() => {
        const derived = getDisplayName(user);
        return derived === 'Usuario' ? '' : derived;
    })();
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [currency, setCurrency] = useState(profile?.currency_base || 'GTQ');
    // NOTE: cutoff_day removed — column doesn't exist in user_profiles and
    // the field was silently failing to save. If reports/billing need a
    // cutoff day in the future, add a migration first then re-introduce.
    const initialGoalType = profile?.goal_type === 'FASTEST' || profile?.goal_type === 'LEAST_INTEREST' || profile?.goal_type === 'BALANCED'
        ? (profile.goal_type as 'FASTEST' | 'LEAST_INTEREST' | 'BALANCED')
        : 'BALANCED';
    const [goalType, setGoalType] = useState<'FASTEST' | 'LEAST_INTEREST' | 'BALANCED'>(initialGoalType);
    const [motivationLevel, setMotivationLevel] = useState(profile?.motivation_level?.toString() || '3');
    const [riskTolerance, setRiskTolerance] = useState(profile?.risk_tolerance?.toString() || '3');
    const [safetyBufferPct, setSafetyBufferPct] = useState(profile?.safety_buffer_pct?.toString() || '10');

    const isPro = subscription?.plan_code === 'PRO' || subscription?.plan_code === 'BUSINESS';
    const isGooglePlayPlan = subscription?.provider === 'google_play';
    const planLabel = isPro
        ? (isGooglePlayPlan ? 'RutaCero PRO Android' : 'RutaCero PRO')
        : 'Plan Gratuito';
    const totpEnabled = (mfaFactors?.totp?.length || 0) > 0;

    const supabase = createClient();
    const useBetterAuth =
        (process.env.NEXT_PUBLIC_AUTH_PROVIDER || '').toLowerCase() === 'better-auth';

    const loadMfaFactors = async () => {
        setMfaLoading(true);
        setMfaError(null);
        try {
            if (useBetterAuth) {
                const { authClient } = await import('@/lib/auth/client');
                const session = await authClient.getSession();
                const enabled = Boolean(
                    (session.data?.user as { twoFactorEnabled?: boolean } | undefined)
                        ?.twoFactorEnabled,
                );
                setMfaFactors(
                    (enabled
                        ? {
                              totp: [{ id: 'better-auth-totp', status: 'verified', factor_type: 'totp' }],
                              all: [],
                              phone: [],
                          }
                        : { totp: [], all: [], phone: [] }) as unknown as MfaFactors,
                );
                return;
            }

            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;
            setMfaFactors(data);
        } catch (error) {
            setMfaError(error instanceof Error ? error.message : 'No se pudo cargar el estado de seguridad');
        } finally {
            setMfaLoading(false);
        }
    };

    useEffect(() => {
        loadMfaFactors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleStartEnroll = async () => {
        setMfaLoading(true);
        setMfaError(null);
        setMfaSuccess(null);
        try {
            if (useBetterAuth) {
                const { authClient } = await import('@/lib/auth/client');
                const password = window.prompt('Confirmá tu contraseña para activar 2FA');
                if (!password) {
                    setMfaError('Se necesita tu contraseña para activar 2FA');
                    return;
                }
                const { data, error } = await authClient.twoFactor.enable({ password });
                if (error) throw new Error(error.message || 'No se pudo iniciar la configuración');
                const totpURI = (data as { totpURI?: string } | null)?.totpURI || '';
                const secret = (data as { totpURI?: string } | null)?.totpURI
                    ? decodeURIComponent(totpURI.split('secret=')[1]?.split('&')[0] || '')
                    : '';
                setEnrollData({
                    id: 'better-auth-enroll',
                    qrCode: totpURI
                        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpURI)}`
                        : '',
                    secret: secret || ((data as { secret?: string } | null)?.secret ?? ''),
                });
                return;
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'RutaCero',
            });
            if (error) throw error;

            const qrCode = data?.totp?.qr_code || '';
            const secret = data?.totp?.secret || '';
            setEnrollData({ id: data?.id, qrCode, secret });
        } catch (error) {
            setMfaError(error instanceof Error ? error.message : 'No se pudo iniciar la configuración');
        } finally {
            setMfaLoading(false);
        }
    };

    const handleVerifyEnroll = async () => {
        if (!enrollData) return;
        setMfaLoading(true);
        setMfaError(null);
        setMfaSuccess(null);
        try {
            if (useBetterAuth) {
                const { authClient } = await import('@/lib/auth/client');
                const { error } = await authClient.twoFactor.verifyTotp({
                    code: verifyCode.trim(),
                });
                if (error) throw new Error(error.message || 'Código inválido');
            } else {
                const { error } = await supabase.auth.mfa.challengeAndVerify({
                    factorId: enrollData.id,
                    code: verifyCode.trim(),
                });
                if (error) throw error;
            }

            setEnrollData(null);
            setVerifyCode('');
            setMfaSuccess('Autenticación de dos pasos activada.');
            await loadMfaFactors();
        } catch (error) {
            setMfaError(error instanceof Error ? error.message : 'Código inválido');
        } finally {
            setMfaLoading(false);
        }
    };

    const handleDisableMfa = async () => {
        const factor = mfaFactors?.totp?.[0];
        if (!factor && !useBetterAuth) return;
        setMfaLoading(true);
        setMfaError(null);
        setMfaSuccess(null);
        try {
            if (useBetterAuth) {
                const { authClient } = await import('@/lib/auth/client');
                const password = window.prompt('Confirmá tu contraseña para desactivar 2FA');
                if (!password) {
                    setMfaError('Se necesita tu contraseña para desactivar 2FA');
                    return;
                }
                const { error } = await authClient.twoFactor.disable({ password });
                if (error) throw new Error(error.message || 'No se pudo desactivar 2FA');
            } else {
                if (!factor) return;
                const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
                if (error) throw error;
            }
            setMfaSuccess('Autenticación de dos pasos desactivada.');
            await loadMfaFactors();
        } catch (error) {
            setMfaError(error instanceof Error ? error.message : 'No se pudo desactivar 2FA');
        } finally {
            setMfaLoading(false);
        }
    };

    const handleSave = async () => {
        startTransition(async () => {
            // Validate display name BEFORE any DB write so we don't
            // half-update if the name is empty/too long.
            const trimmedDisplayName = displayName.trim();
            if (trimmedDisplayName.length < 2) {
                const message = 'El nombre debe tener al menos 2 caracteres.';
                toast.error(message);
                return;
            }
            if (trimmedDisplayName.length > 80) {
                const message = 'El nombre no puede exceder 80 caracteres.';
                toast.error(message);
                return;
            }

            try {
                // 1. Update profile preferences (currency, goal, motivation,
                //    risk, safety buffer). NOTE: display_name and cutoff_day
                //    are NOT included — neither column exists in user_profiles.
                //    Display name is persisted separately to auth.user_metadata
                //    via updateDisplayName below.
                const { error } = await supabase
                    .from('user_profiles')
                    .update({
                        currency_base: currency,
                        goal_type: goalType,
                        motivation_level: parseInt(motivationLevel) || 3,
                        risk_tolerance: parseInt(riskTolerance) || 3,
                        safety_buffer_pct: parseFloat(safetyBufferPct) || 10,
                    })
                    .eq('user_id', user.id);

                if (error) throw error;

                // 2. Update display name via the server action (which writes
                //    to auth.user_metadata via admin client). Only run if it
                //    actually changed — saves an auth round-trip on no-op
                //    saves.
                if (trimmedDisplayName !== initialDisplayName) {
                    const nameResult = await updateDisplayName({
                        fullName: trimmedDisplayName,
                    });
                    if (!nameResult.success) {
                        toast.error(nameResult.error || 'No se pudo guardar el nombre.');
                        return;
                    }
                }

                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                toast.success('Configuración guardada.');
                router.refresh();
            } catch (error) {
                console.error('Error saving settings:', error);
                toast.error(
                    error instanceof Error
                        ? `No se pudo guardar: ${error.message}`
                        : 'No se pudo guardar la configuración.',
                );
            }
        });
    };

    const triggerCsvDownload = (csv: string, filename: string) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleExportRawDebts = async () => {
        setExportError(null);
        setIsExportingDebts(true);
        try {
            const result = await exportRawDebts();
            if (result.success && result.data) {
                triggerCsvDownload(
                    result.data,
                    `mis-deudas_${new Date().toISOString().split('T')[0]}.csv`
                );
            } else {
                setExportError(result.error || 'No se pudo exportar.');
            }
        } catch (error) {
            console.error('Export failed:', error);
            setExportError('No se pudo exportar.');
        } finally {
            setIsExportingDebts(false);
        }
    };

    const handleExportRawPayments = async () => {
        setExportError(null);
        setIsExportingPayments(true);
        try {
            const result = await exportRawPayments();
            if (result.success && result.data) {
                triggerCsvDownload(
                    result.data,
                    `mis-pagos_${new Date().toISOString().split('T')[0]}.csv`
                );
            } else {
                setExportError(result.error || 'No se pudo exportar.');
            }
        } catch (error) {
            console.error('Export failed:', error);
            setExportError('No se pudo exportar.');
        } finally {
            setIsExportingPayments(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const handleCancelSubscription = async () => {
        setIsCanceling(true);
        try {
            const response = await fetch('/api/recurrente/cancel-subscription', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Error al cancelar');
            }

            setShowCancelDialog(false);
            router.refresh();
        } catch (error) {
            console.error('Error canceling subscription:', error);
        } finally {
            setIsCanceling(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                    Configuración
                </h1>
                <p className="text-muted-foreground">
                    Gestiona tu perfil y preferencias
                </p>
            </div>

            {/* Profile Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5" />
                        Perfil
                    </CardTitle>
                    <CardDescription>
                        Tu información personal y preferencias
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            value={user.email || ''}
                            disabled
                            className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                            El correo no se puede cambiar
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="displayName">Nombre para Mostrar</Label>
                        <Input
                            id="displayName"
                            placeholder="Tu nombre"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="currency">Moneda Preferida</Label>
                            <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger className="h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GTQ">Quetzales (GTQ)</SelectItem>
                                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Ajusta los montos a tu moneda principal.
                            </p>
                        </div>

                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">Preferencias de planificación</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Ajustan la recomendación de estrategia y reservan un buffer para hacer tu plan más realista.
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Objetivo principal</Label>
                                <Select value={goalType} onValueChange={(v) => setGoalType(v as typeof goalType)}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FASTEST">Salir más rápido</SelectItem>
                                        <SelectItem value="LEAST_INTEREST">Pagar menos interés</SelectItem>
                                        <SelectItem value="BALANCED">Balanceado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="safetyBufferPct">Buffer de seguridad (%)</Label>
                                <Input
                                    id="safetyBufferPct"
                                    type="number"
                                    min={0}
                                    max={50}
                                    value={safetyBufferPct}
                                    onChange={(e) => setSafetyBufferPct(e.target.value)}
                                    className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Reservamos este porcentaje del presupuesto antes de calcular el plan.
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label>Motivación / gusto por victorias rápidas</Label>
                                <Select value={motivationLevel} onValueChange={setMotivationLevel}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 (Necesito wins rápidas)</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                        <SelectItem value="3">3 (Neutral)</SelectItem>
                                        <SelectItem value="4">4</SelectItem>
                                        <SelectItem value="5">5 (Puedo sostener planes largos)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>Tolerancia al riesgo (presupuesto ajustado)</Label>
                                <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 (Muy conservador)</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                        <SelectItem value="3">3 (Neutral)</SelectItem>
                                        <SelectItem value="4">4</SelectItem>
                                        <SelectItem value="5">5 (Más agresivo)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : saved ? (
                                '✓ Guardado'
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Guardar Cambios
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Subscription Info */}
            <Card className={isPro ? 'border-amber-500/30' : ''}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Suscripción
                    </CardTitle>
                    <CardDescription>
                        Tu plan y facturación
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                            {isPro && (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
                                    <Crown className="h-5 w-5 text-white" />
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium">{planLabel}</p>
                                    {isPro && (
                                        <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/20">
                                            Activo
                                        </Badge>
                                    )}
                                </div>
                                {isPro && subscription?.renew_at && (
                                    <p className="text-sm text-muted-foreground">
                                        {isGooglePlayPlan ? 'Vence el ' : 'Renueva el '}
                                        {new Date(subscription.renew_at).toLocaleDateString('es-GT', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </p>
                                )}
                                {isPro && isGooglePlayPlan && (
                                    <p className="text-sm text-muted-foreground">
                                        Pase de 30 días sin auto-renovación. Cuando venza, podés comprar otro pase desde Android.
                                    </p>
                                )}
                                {!isPro && (
                                    <p className="text-sm text-muted-foreground">
                                        5 deudas máximo, historial limitado
                                    </p>
                                )}
                            </div>
                        </div>
                        {isPro && !isGooglePlayPlan ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={() => setShowCancelDialog(true)}
                            >
                                Cancelar Plan
                            </Button>
                        ) : isPro ? (
                            <div className="text-right text-xs text-muted-foreground">
                                Compra administrada por Google Play
                            </div>
                        ) : (
                            <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                                <Link href="/pricing">
                                    <Crown className="mr-2 h-4 w-4" />
                                    Actualizar a PRO
                                </Link>
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                            <p className="font-medium">Miembro desde</p>
                            <p className="text-sm text-muted-foreground">
                                {profile?.created_at
                                    ? new Date(profile.created_at).toLocaleDateString('es-GT', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    })
                                    : 'N/A'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Mis datos — Right of data portability (FREE) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Mis datos
                    </CardTitle>
                    <CardDescription>
                        Exporta tus datos crudos sin costo (derecho de portabilidad).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Descargá tus deudas y pagos tal como los ingresaste, en formato CSV.
                        Estos archivos contienen únicamente los datos que vos registraste.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            onClick={handleExportRawDebts}
                            disabled={isExportingDebts}
                        >
                            {isExportingDebts ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Descargar mis deudas (CSV)
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleExportRawPayments}
                            disabled={isExportingPayments}
                        >
                            {isExportingPayments ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Descargar mis pagos (CSV)
                        </Button>
                    </div>
                    {exportError && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {exportError}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        Seguridad
                    </CardTitle>
                    <CardDescription>
                        Activá autenticación de dos pasos para proteger tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-4">
                        <div>
                            <p className="font-medium">Autenticador (TOTP)</p>
                            <p className="text-sm text-muted-foreground">
                                Usá Google Authenticator, Authy o 1Password.
                            </p>
                        </div>
                        <Badge variant={totpEnabled ? 'success' : 'secondary'}>
                            {totpEnabled ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </div>

                    {mfaError && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {mfaError}
                        </div>
                    )}
                    {mfaSuccess && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
                            {mfaSuccess}
                        </div>
                    )}

                    {totpEnabled ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Podés desactivar 2FA en cualquier momento.
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleDisableMfa}
                                disabled={mfaLoading}
                            >
                                {mfaLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <KeyRound className="mr-2 h-4 w-4" />
                                )}
                                Desactivar 2FA
                            </Button>
                        </div>
                    ) : (
                        <>
                            {!enrollData ? (
                                <Button onClick={handleStartEnroll} disabled={mfaLoading}>
                                    {mfaLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <KeyRound className="mr-2 h-4 w-4" />
                                    )}
                                    Configurar autenticador
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-lg border border-border bg-white p-4">
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Escanea el QR en tu app de autenticación.
                                        </p>
                                        {enrollData.qrCode ? (
                                            <Image
                                                src={enrollData.qrCode}
                                                alt="QR de autenticación"
                                                width={160}
                                                height={160}
                                                className="mx-auto h-40 w-40"
                                                unoptimized
                                            />
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Usa esta clave: <span className="font-mono">{enrollData.secret}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                        <div className="space-y-2">
                                            <Label htmlFor="mfaCode">Código del autenticador</Label>
                                            <Input
                                                id="mfaCode"
                                                value={verifyCode}
                                                onChange={(event) => setVerifyCode(event.target.value)}
                                                placeholder="123456"
                                                inputMode="numeric"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setEnrollData(null);
                                                    setVerifyCode('');
                                                }}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button onClick={handleVerifyEnroll} disabled={mfaLoading}>
                                                {mfaLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : null}
                                                Verificar y activar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Sign Out */}
            <Card className="border-destructive/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <LogOut className="h-5 w-5" />
                        Cerrar Sesión
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Cierra tu sesión en este dispositivo
                    </p>
                    <Button variant="destructive" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <Trash2 className="h-5 w-5" />
                        Zona peligrosa
                    </CardTitle>
                    <CardDescription>
                        Eliminar permanentemente tu cuenta y todos tus datos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Solicita la eliminación de tu cuenta. Tendrás 7 días de gracia para
                        cambiar de opinión antes de que se ejecute.
                    </p>
                    <Button asChild variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Link href="/settings/delete-account">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar mi cuenta
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Cancel Subscription Dialog */}
            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            ¿Cancelar suscripción?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Si cancelas, perderás acceso a:
                            <ul className="mt-2 space-y-1 text-left">
                                <li>• Deudas ilimitadas</li>
                                <li>• Simulador What-If</li>
                                <li>• Exportar escenarios What-If</li>
                                <li>• Exportación CSV</li>
                                <li>• Historial completo</li>
                            </ul>
                            <p className="mt-3">
                                Tu plan seguirá activo hasta el final del período de facturación.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Mantener PRO</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCancelSubscription}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isCanceling}
                        >
                            {isCanceling ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelando...
                                </>
                            ) : (
                                'Sí, cancelar'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
