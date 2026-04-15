import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import {
    getAdminAssignees,
    getAdminSavedViews,
    getAdminTicketListData,
    syncSupportAlerts,
} from '@/lib/actions/admin-support';
import { AdminSupportClient } from '../support-client';

export const metadata = {
    title: 'Tickets | Admin RutaCero',
};

export default async function SupportTicketsPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    const canReadTickets = await roleHasPermission(session.role, 'tickets:read');
    if (!canReadTickets) {
        redirect('/admin/dashboard');
    }

    const canManageTemplates = await roleHasPermission(session.role, 'tickets:update');
    const showSlaTab = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN';
    const [listData, assigneesData, savedViews] = await Promise.all([
        getAdminTicketListData(),
        getAdminAssignees(),
        getAdminSavedViews(),
    ]);
    await syncSupportAlerts();

    return (
        <AdminSupportClient
            tickets={listData.tickets}
            messageStats={listData.messageStats}
            adminId={session.adminId}
            assignees={assigneesData.assignees}
            canAssign={assigneesData.canAssign}
            canManageTemplates={canManageTemplates}
            savedViews={savedViews}
            showSlaTab={showSlaTab}
        />
    );
}
