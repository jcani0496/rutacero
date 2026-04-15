import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getReplyTemplates } from '@/lib/actions/admin-support';
import { TemplatesClient } from './templates-client';

export const metadata = {
    title: 'Plantillas de Respuesta | Admin',
};

export default async function SupportTemplatesPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    const canRead = await roleHasPermission(session.role, 'tickets:read');
    if (!canRead) {
        redirect('/admin/dashboard');
    }

    const canManage = await roleHasPermission(session.role, 'tickets:update');
    const templates = await getReplyTemplates(true);

    return (
        <div className="p-6 space-y-6">
            <TemplatesClient templates={templates} canManage={canManage} />
        </div>
    );
}
