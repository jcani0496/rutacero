import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getStandardReports, getAvailableTables } from '@/lib/actions/admin-reports';
import { ReportsClient } from './reports-client';

export const metadata = {
    title: 'Reportes | Admin RutaCero',
    description: 'Generación de reportes administrativos',
};

export default async function AdminReportsPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }
    if (!(await roleHasPermission(session.role, 'reports:read'))) {
        redirect('/admin/dashboard');
    }

    const [standardReports, tables] = await Promise.all([
        getStandardReports(),
        getAvailableTables(),
    ]);

    return (
        <div className="p-6 space-y-6">
            <ReportsClient
                standardReports={standardReports}
                tables={tables}
            />
        </div>
    );
}
