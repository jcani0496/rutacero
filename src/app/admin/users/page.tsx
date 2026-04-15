import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getUsers } from '@/lib/actions/admin-users';
import { UsersClient } from './users-client';

export const metadata = {
    title: 'Clientes | Admin RutaCero',
};

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; page?: string }>;
}) {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }
    if (!(await roleHasPermission(session.role, 'users:read'))) {
        redirect('/admin/dashboard');
    }

    const params = await searchParams;
    const search = params.search || '';
    const page = parseInt(params.page || '1');

    const { users, total } = await getUsers({ search, page, limit: 20 });

    return (
        <div className="p-6 space-y-6">
            <UsersClient
                users={users}
                total={total}
                page={page}
                initialSearch={search}
            />
        </div>
    );
}
