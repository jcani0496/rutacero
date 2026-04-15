import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { SeedDataClient } from './seed-client';

export const metadata = {
    title: 'Seed Data | Admin',
    description: 'Inject test data for development',
};

export default async function SeedDataPage() {
    const session = await getAdminSession();
    if (!session) {
        redirect('/admin/login');
    }
    if (!(await roleHasPermission(session.role, 'seed:run'))) {
        redirect('/admin/dashboard');
    }

    const supabase = await createAdminClient();

    // Get all users for selection
    const { data: authData } = await supabase.auth.admin.listUsers();
    const users = authData?.users || [];

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-2xl font-bold">Seed Test Data</h1>
                <p className="text-muted-foreground">
                    Inject realistic Guatemalan financial test data for visual testing
                </p>
            </div>
            <SeedDataClient users={users.map(u => ({ id: u.id, email: u.email || 'Sin email' }))} />
        </div>
    );
}
