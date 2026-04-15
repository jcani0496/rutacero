import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/actions/admin-auth';

// Redirect /admin to /admin/dashboard or /admin/login
export default async function AdminIndexPage() {
    const session = await getAdminSession();

    if (session) {
        redirect('/admin/dashboard');
    } else {
        redirect('/admin/login');
    }
}
