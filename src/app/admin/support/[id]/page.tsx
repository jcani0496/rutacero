import { redirect, notFound } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import {
    getAdminAssignees,
    getAdminTicketDetail,
    getAdminTicketHistory,
    getAdminTicketLabels,
    getReplyTemplates,
} from '@/lib/actions/admin-support';
import { AdminTicketClient } from './ticket-client';

export const metadata = {
    title: 'Ticket | Admin RutaCero',
};

export default async function AdminTicketPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getAdminSession();
    if (!session) {
        redirect('/admin/login');
    }
    if (!(await roleHasPermission(session.role, 'tickets:read'))) {
        redirect('/admin/dashboard');
    }

    const { id } = await params;
    if (!id || id === 'undefined') {
        notFound();
    }

    const [detail, assigneeData, labels, history, templates] = await Promise.all([
        getAdminTicketDetail(id),
        getAdminAssignees(),
        getAdminTicketLabels(id),
        getAdminTicketHistory(id),
        getReplyTemplates(),
    ]);

    if (!detail) {
        notFound();
    }

    return (
        <AdminTicketClient
            ticket={detail.ticket}
            messages={detail.messages}
            userEmail={detail.userEmail}
            assignees={assigneeData.assignees}
            canAssign={assigneeData.canAssign}
            adminId={session.adminId}
            labels={labels}
            history={history}
            templates={templates}
        />
    );
}
