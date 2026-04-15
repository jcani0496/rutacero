import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getAuditActors, getAuditLogs } from '@/lib/actions/admin-audit';
import { AuditClient } from './audit-client';

export const metadata = {
    title: 'Auditoría | Admin RutaCero',
};

export default async function AuditPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    const canReadAudit = await roleHasPermission(session.role, 'audit:read');
    if (!canReadAudit) {
        redirect('/admin/dashboard');
    }

    const [logs, admins] = await Promise.all([
        getAuditLogs({ limit: 200 }),
        getAuditActors(),
    ]);

    return <AuditClient initialLogs={logs} admins={admins} />;
}
