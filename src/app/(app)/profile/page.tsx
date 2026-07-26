import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
    Calendar,
    Envelope,
    Globe,
    Target,
    User
} from '@phosphor-icons/react/dist/ssr';
import type { AppUser } from '@/lib/auth/session';
// AppUser is the F6 auth shape; keep a local alias for the display object.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '@/lib/auth/display-name';
import { getAppUser } from '@/lib/auth/session';
import { getCurrentUserProfile } from '@/lib/actions/profile';
import { DisplayNameEditor } from './display-name-editor';

export const metadata = {
    title: 'Perfil | RutaCero',
    description: 'Resumen de tu perfil y preferencias',
};

const PAY_FREQUENCY_LABELS: Record<string, string> = {
    BIWEEKLY: 'Quincenal',
    MONTHLY: 'Mensual',
    VARIABLE: 'Variable',
};

const GOAL_LABELS: Record<string, string> = {
    FASTEST: 'Más rápido',
    LEAST_INTEREST: 'Menor interés',
    BALANCED: 'Balanceado',
};

export default async function ProfilePage() {
    const appUser = await getAppUser();
    if (!appUser) {
        redirect('/login');
    }

    const user: AppUser = {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
        user_metadata: { full_name: appUser.name, name: appUser.name },
    };

    const profile = await getCurrentUserProfile();
    const displayName = getDisplayName(user);

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Perfil
                    </h1>
                    <p className="text-muted-foreground">
                        Información de tu cuenta y preferencias
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/settings">Editar en configuración</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User weight="regular" className="h-5 w-5" />
                        Información básica
                    </CardTitle>
                    <CardDescription>
                        Datos principales de tu cuenta
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <DisplayNameEditor initialName={displayName} />
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium flex items-center gap-2">
                            <Envelope weight="regular" className="h-4 w-4 text-muted-foreground" />
                            {user.email}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Onboarding</p>
                        <Badge variant={profile?.onboarding_completed ? 'success' : 'secondary'}>
                            {profile?.onboarding_completed ? 'Completado' : 'Pendiente'}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target weight="regular" className="h-5 w-5" />
                        Preferencias financieras
                    </CardTitle>
                    <CardDescription>
                        Cómo ajustamos tus planes y reportes
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Moneda base</p>
                        <p className="font-medium">{profile?.currency_base || 'GTQ'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Frecuencia de pago</p>
                        <p className="font-medium">
                            {PAY_FREQUENCY_LABELS[profile?.pay_frequency || 'BIWEEKLY']}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Días de pago</p>
                        <p className="font-medium flex items-center gap-2">
                            <Calendar weight="regular" className="h-4 w-4 text-muted-foreground" />
                            {(profile?.pay_dates || []).join(', ') || 'N/A'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Objetivo</p>
                        <p className="font-medium">
                            {GOAL_LABELS[profile?.goal_type || 'BALANCED']}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Zona horaria</p>
                        <p className="font-medium flex items-center gap-2">
                            <Globe weight="regular" className="h-4 w-4 text-muted-foreground" />
                            {profile?.timezone || 'America/Guatemala'}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
