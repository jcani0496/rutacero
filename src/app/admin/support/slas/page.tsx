import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import {
    getAdminSupportMetrics,
    getAdminTicketListData,
    getSupportAgentMetrics,
    syncSupportAlerts,
} from '@/lib/actions/admin-support';
import { SupportSlaClient } from './sla-client';

export const metadata = {
    title: 'SLAs | Admin RutaCero',
};

export default async function SupportSlaPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    const isManager = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN';
    if (!isManager) {
        redirect('/admin/support/tickets');
    }

    const canReadTickets = await roleHasPermission(session.role, 'tickets:read');
    if (!canReadTickets) {
        redirect('/admin/dashboard');
    }

    const canEscalate = await roleHasPermission(session.role, 'tickets:update');
    const [metrics, listData, agentMetrics] = await Promise.all([
        getAdminSupportMetrics(),
        getAdminTicketListData(),
        getSupportAgentMetrics(),
    ]);
    await syncSupportAlerts();

    return (
        <SupportSlaClient
            tickets={listData.tickets}
            messageStats={listData.messageStats}
            metrics={metrics}
            agentMetrics={agentMetrics}
            canEscalate={canEscalate}
        />
    );
}
