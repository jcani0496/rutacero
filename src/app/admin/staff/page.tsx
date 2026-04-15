import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getAdminStaff } from '@/lib/actions/admin-staff';
import { StaffClient } from './staff-client';

export const metadata = {
    title: 'Personal RutaCero | Admin',
};

export default async function AdminStaffPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string }>;
}) {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    if (!(await roleHasPermission(session.role, 'staff:read'))) {
        redirect('/admin/dashboard');
    }

    const params = await searchParams;
    const search = params.search || '';
    const staff = await getAdminStaff(search);

    return (
        <div className="p-6 space-y-6">
            <StaffClient staff={staff} initialSearch={search} />
        </div>
    );
}
