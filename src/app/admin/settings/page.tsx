import { redirect } from 'next/navigation';
import { Gear, FileText, Clock, User, Shield } from '@phosphor-icons/react/dist/ssr';
import { ICON } from '@/components/icons/phosphor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { getAdminMfaStatus, getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getAdminSupportSettings, getSupportAutomationRules } from '@/lib/actions/admin-support';
import { getLoginLockouts } from '@/lib/actions/admin-security';
import { SupportSettingsClient } from './support-settings-client';
import { LoginLockoutsClient } from './login-lockouts-client';
import { AdminMfaClient } from './admin-mfa-client';
import { AdminChangePasswordClient } from './admin-change-password-client';

export const metadata = {
    title: 'Configuración | Admin RutaCero',
};

interface AuditLog {
    id: string;
    admin_id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: unknown;
    created_at: string;
}

export default async function AdminSettingsPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }
    const canReadSettings = await roleHasPermission(session.role, 'settings:read');
    if (!canReadSettings) {
        redirect('/admin/dashboard');
    }

    const canReadAudit = await roleHasPermission(session.role, 'audit:read');
    const canAssignTickets = await roleHasPermission(session.role, 'tickets:assign');
    const canManageSupport = await roleHasPermission(session.role, 'tickets:update');
    const canManageSecurity = await roleHasPermission(session.role, 'staff:update');
    const [supportSettings, supportRules] = await Promise.all([
        canAssignTickets
            ? getAdminSupportSettings().catch(() => null)
            : Promise.resolve(null),
        canManageSupport
            ? getSupportAutomationRules().catch(() => [])
            : Promise.resolve([]),
    ]);
    const lockouts = canManageSecurity
        ? await getLoginLockouts(100).catch(() => [])
        : [];
    const mfaStatus = await getAdminMfaStatus();

    // Fetch recent audit logs via Drizzle (Supabase client removed in F6).
    let auditLogs: AuditLog[] = [];
    try {
        if (canReadAudit) {
            const db = getDb();
            const rows = await db
                .select({
                    id: schema.auditLogs.id,
                    adminId: schema.auditLogs.adminId,
                    adminUserId: schema.auditLogs.adminUserId,
                    action: schema.auditLogs.action,
                    entityType: schema.auditLogs.entityType,
                    entityId: schema.auditLogs.entityId,
                    details: schema.auditLogs.details,
                    createdAt: schema.auditLogs.createdAt,
                })
                .from(schema.auditLogs)
                .orderBy(desc(schema.auditLogs.createdAt))
                .limit(50);

            auditLogs = rows.map((row) => ({
                id: row.id,
                admin_id: row.adminId || row.adminUserId,
                action: row.action,
                entity_type: row.entityType,
                entity_id: row.entityId,
                details: row.details,
                created_at: row.createdAt.toISOString(),
            }));
        }
    } catch {
        // Table might not exist yet
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionBadge = (action: string) => {
        if (action.includes('LOGIN')) return <Badge variant="outline">Login</Badge>;
        if (action.includes('LOGOUT')) return <Badge variant="secondary">Logout</Badge>;
        if (action.includes('CREATE')) return <Badge className="bg-emerald-500">Crear</Badge>;
        if (action.includes('UPDATE')) return <Badge variant="warning">Actualizar</Badge>;
        if (action.includes('DELETE')) return <Badge variant="destructive">Eliminar</Badge>;
        return <Badge variant="outline">{action}</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Configuración</h1>
                <p className="text-muted-foreground">
                    Configuración del sistema y logs de auditoría
                </p>
            </div>

            {/* Admin Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield {...ICON} className="h-5 w-5" />
                        Tu Cuenta Admin
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium truncate">{session.email}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-sm text-muted-foreground">Nombre</p>
                            <p className="font-medium">{session.displayName || 'N/A'}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-sm text-muted-foreground">Rol</p>
                            <Badge variant="outline" className="mt-1">
                                {session.role.replace('_', ' ')}
                            </Badge>
                        </div>
                    </div>

                    <div className="pt-4 border-t space-y-4">
                        <AdminChangePasswordClient />
                        {mfaStatus && (
                            <div className="pt-2">
                                <p className="text-sm font-medium mb-2">Autenticación en dos pasos (MFA)</p>
                                <AdminMfaClient
                                    initialEnabled={mfaStatus.mfaEnabled}
                                    secretConfigured={mfaStatus.secretConfigured}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {supportSettings && (
                <SupportSettingsClient
                    settings={supportSettings}
                    rules={supportRules}
                    canManageRules={canManageSupport}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield {...ICON} className="h-5 w-5" />
                        Seguridad de Login
                    </CardTitle>
                    <CardDescription>
                        Bloqueos progresivos y mantenimiento de eventos de seguridad.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!canManageSecurity ? (
                        <div className="text-sm text-muted-foreground">
                            No tienes permisos para gestionar seguridad de login.
                        </div>
                    ) : (
                        <LoginLockoutsClient initialLockouts={lockouts} />
                    )}
                </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText {...ICON} className="h-5 w-5" />
                        Logs de Auditoría
                    </CardTitle>
                    <CardDescription>
                        Registro de acciones administrativas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!canReadAudit ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <FileText {...ICON} className="h-10 w-10 mb-3 opacity-50" />
                            <p className="text-sm">
                                No tienes permisos para ver los logs.
                            </p>
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <FileText {...ICON} className="h-12 w-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Sin registros</p>
                            <p className="text-sm">
                                No hay logs de auditoría disponibles
                            </p>
                            <p className="text-xs mt-2 text-muted-foreground/70">
                                (La tabla se creará con la migración)
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {auditLogs.map((log) => (
                                <div
                                    key={log.id}
                                    className="flex items-start gap-4 rounded-lg border p-3 text-sm"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getActionBadge(log.action)}
                                            <span className="text-muted-foreground">
                                                {log.entity_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            {log.entity_id || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock {...ICON} className="h-3 w-3" />
                                            {formatDate(log.created_at)}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                            <User {...ICON} className="h-3 w-3" />
                                            {log.admin_id ? `${log.admin_id.slice(0, 8)}…` : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* System Settings (placeholder) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gear {...ICON} className="h-5 w-5" />
                        Configuración del Sistema
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <p className="text-sm">
                            Configuración avanzada del motor de cálculo (próximamente)
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
