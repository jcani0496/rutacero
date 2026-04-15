import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/actions/admin-auth';
import AdminLoginForm from './admin-login-form';

export default async function AdminLoginPage() {
    const session = await getAdminSession();

    if (session) {
        redirect('/admin/dashboard');
    }

    return <AdminLoginForm />;
}
