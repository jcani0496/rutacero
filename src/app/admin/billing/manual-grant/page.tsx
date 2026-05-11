import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import GrantFormClient from './grant-form-client';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Activación manual | Admin RutaCero',
};

export default async function ManualGrantPage({
    searchParams,
}: {
    searchParams: Promise<{ tenantId?: string }>;
}) {
    const session = await getAdminSession();
    if (!session) redirect('/admin/login');
    if (!(await roleHasPermission(session.role, 'subscriptions:update'))) {
        redirect('/admin/dashboard');
    }
    const { tenantId } = await searchParams;
    return (
        <div className="p-6 max-w-xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Activar PRO por transferencia bancaria</h1>
                <p className="text-sm text-muted-foreground">
                    Confirma el comprobante antes de activar. Queda en auditoría.
                </p>
            </div>
            <GrantFormClient initialTenantId={tenantId ?? ''} />
        </div>
    );
}
