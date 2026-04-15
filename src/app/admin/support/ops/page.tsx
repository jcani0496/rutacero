import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import {
    getAdminSupportMetrics,
    getAdminTicketListData,
    getSupportAgentMetrics,
    syncSupportAlerts,
} from '@/lib/actions/admin-support';
import { SupportOpsClient } from './support-ops-client';

export const metadata = {
    title: 'Operaciones | Admin RutaCero',
};

export default async function SupportOpsPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    const canReadTickets = await roleHasPermission(session.role, 'tickets:read');
    if (!canReadTickets) {
        redirect('/admin/dashboard');
    }

    const [listData, metrics, agentMetrics] = await Promise.all([
        getAdminTicketListData(),
        getAdminSupportMetrics(),
        getSupportAgentMetrics(),
    ]);

    await syncSupportAlerts();

    return (
        <SupportOpsClient
            tickets={listData.tickets}
            messageStats={listData.messageStats}
            metrics={metrics}
            agentMetrics={agentMetrics}
        />
    );
}
