import { createAdminClient } from '@/lib/supabase/server';
import { isDrizzleEnabled } from '@/lib/data/provider';
import type { Database } from '@/types/supabase';
import {
    drizzleAssignTicket,
    drizzleGetActiveAssignments,
    drizzleGetAssignableAdmins,
    drizzleGetSupportSettings,
    drizzleGetUnassignedTickets,
    drizzleInsertSupportSettings,
    drizzleUpdateSupportSettings,
} from '@/lib/support/drizzle';

export type TicketPriority = Database['public']['Enums']['ticket_priority'];
export type TicketStatus = Database['public']['Enums']['ticket_status'];
export type AutoAssignStrategy = 'LOAD_BALANCED' | 'ROUND_ROBIN';

export interface SupportAssignmentSettings {
    id: string;
    auto_assign_enabled: boolean;
    auto_assign_strategy: AutoAssignStrategy;
    auto_assign_priorities: TicketPriority[];
    last_round_robin_index: number;
    sla_escalation_enabled: boolean;
    stale_reassign_enabled: boolean;
    stale_reassign_hours: number;
    updated_at: string;
}

interface AssignableAdmin {
    id: string;
    email: string;
    display_name: string | null;
    role: Database['public']['Enums']['admin_role'];
}

interface AssignableTicket {
    id: string;
    priority: TicketPriority;
    status: TicketStatus;
    created_at: string;
}

const DEFAULT_SETTINGS: Omit<SupportAssignmentSettings, 'id' | 'updated_at'> = {
    auto_assign_enabled: false,
    auto_assign_strategy: 'LOAD_BALANCED',
    auto_assign_priorities: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'],
    last_round_robin_index: 0,
    sla_escalation_enabled: false,
    stale_reassign_enabled: false,
    stale_reassign_hours: 24,
};

const ASSIGNABLE_ROLES: Database['public']['Enums']['admin_role'][] = [
    'SUPER_ADMIN',
    'ADMIN',
    'SUPPORT',
];

const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS'];
const PRIORITY_ORDER: TicketPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const priorityRank = new Map(PRIORITY_ORDER.map((priority, index) => [priority, index]));

const normalizePriorities = (priorities: TicketPriority[] | null | undefined) => {
    if (!priorities || priorities.length === 0) {
        return [...DEFAULT_SETTINGS.auto_assign_priorities];
    }
    return priorities.filter((priority) => PRIORITY_ORDER.includes(priority));
};

const fallbackSettings = (): SupportAssignmentSettings => ({
    id: '00000000-0000-0000-0000-000000000000',
    auto_assign_enabled: DEFAULT_SETTINGS.auto_assign_enabled,
    auto_assign_strategy: DEFAULT_SETTINGS.auto_assign_strategy,
    auto_assign_priorities: [...DEFAULT_SETTINGS.auto_assign_priorities],
    last_round_robin_index: DEFAULT_SETTINGS.last_round_robin_index,
    sla_escalation_enabled: DEFAULT_SETTINGS.sla_escalation_enabled,
    stale_reassign_enabled: DEFAULT_SETTINGS.stale_reassign_enabled,
    stale_reassign_hours: DEFAULT_SETTINGS.stale_reassign_hours,
    updated_at: new Date().toISOString(),
});

async function getSupportAssignmentSettingsDrizzle(): Promise<SupportAssignmentSettings> {
    try {
        let settings = await drizzleGetSupportSettings();
        if (!settings?.id) {
            settings = await drizzleInsertSupportSettings({
                autoAssignEnabled: DEFAULT_SETTINGS.auto_assign_enabled,
                autoAssignStrategy: DEFAULT_SETTINGS.auto_assign_strategy,
                autoAssignPriorities: DEFAULT_SETTINGS.auto_assign_priorities,
                lastRoundRobinIndex: DEFAULT_SETTINGS.last_round_robin_index,
                slaEscalationEnabled: DEFAULT_SETTINGS.sla_escalation_enabled,
                staleReassignEnabled: DEFAULT_SETTINGS.stale_reassign_enabled,
                staleReassignHours: DEFAULT_SETTINGS.stale_reassign_hours,
            });
        }
        if (!settings) {
            return fallbackSettings();
        }
        return {
            id: settings.id,
            auto_assign_enabled: settings.auto_assign_enabled ?? DEFAULT_SETTINGS.auto_assign_enabled,
            auto_assign_strategy: (settings.auto_assign_strategy as AutoAssignStrategy) ?? DEFAULT_SETTINGS.auto_assign_strategy,
            auto_assign_priorities: normalizePriorities(settings.auto_assign_priorities as TicketPriority[]),
            last_round_robin_index: settings.last_round_robin_index ?? DEFAULT_SETTINGS.last_round_robin_index,
            sla_escalation_enabled: settings.sla_escalation_enabled ?? DEFAULT_SETTINGS.sla_escalation_enabled,
            stale_reassign_enabled: settings.stale_reassign_enabled ?? DEFAULT_SETTINGS.stale_reassign_enabled,
            stale_reassign_hours: settings.stale_reassign_hours ?? DEFAULT_SETTINGS.stale_reassign_hours,
            updated_at: settings.updated_at,
        };
    } catch (error) {
        console.error('Error fetching support settings (drizzle):', error);
        return fallbackSettings();
    }
}

export async function getSupportAssignmentSettings(
    adminClient = createAdminClient()
): Promise<SupportAssignmentSettings> {
    if (isDrizzleEnabled()) {
        return getSupportAssignmentSettingsDrizzle();
    }

    const { data, error } = await adminClient
        .from('admin_support_settings')
        .select('id, auto_assign_enabled, auto_assign_strategy, auto_assign_priorities, last_round_robin_index, sla_escalation_enabled, stale_reassign_enabled, stale_reassign_hours, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching support settings:', error?.message || error);
    }

    if (!data?.id) {
        const { data: created, error: insertError } = await adminClient
            .from('admin_support_settings')
            .insert({
                auto_assign_enabled: DEFAULT_SETTINGS.auto_assign_enabled,
                auto_assign_strategy: DEFAULT_SETTINGS.auto_assign_strategy,
                auto_assign_priorities: DEFAULT_SETTINGS.auto_assign_priorities,
                last_round_robin_index: DEFAULT_SETTINGS.last_round_robin_index,
                sla_escalation_enabled: DEFAULT_SETTINGS.sla_escalation_enabled,
                stale_reassign_enabled: DEFAULT_SETTINGS.stale_reassign_enabled,
                stale_reassign_hours: DEFAULT_SETTINGS.stale_reassign_hours,
            })
            .select('id, auto_assign_enabled, auto_assign_strategy, auto_assign_priorities, last_round_robin_index, sla_escalation_enabled, stale_reassign_enabled, stale_reassign_hours, updated_at')
            .single();

        if (insertError || !created) {
            console.error('Error creating support settings:', insertError?.message || insertError);
            return fallbackSettings();
        }

        return {
            id: created.id,
            auto_assign_enabled: created.auto_assign_enabled ?? DEFAULT_SETTINGS.auto_assign_enabled,
            auto_assign_strategy: (created.auto_assign_strategy as AutoAssignStrategy) ?? DEFAULT_SETTINGS.auto_assign_strategy,
            auto_assign_priorities: normalizePriorities(created.auto_assign_priorities as TicketPriority[]),
            last_round_robin_index: created.last_round_robin_index ?? DEFAULT_SETTINGS.last_round_robin_index,
            sla_escalation_enabled: created.sla_escalation_enabled ?? DEFAULT_SETTINGS.sla_escalation_enabled,
            stale_reassign_enabled: created.stale_reassign_enabled ?? DEFAULT_SETTINGS.stale_reassign_enabled,
            stale_reassign_hours: created.stale_reassign_hours ?? DEFAULT_SETTINGS.stale_reassign_hours,
            updated_at: created.updated_at,
        };
    }

    return {
        id: data.id,
        auto_assign_enabled: data.auto_assign_enabled ?? DEFAULT_SETTINGS.auto_assign_enabled,
        auto_assign_strategy: (data.auto_assign_strategy as AutoAssignStrategy) ?? DEFAULT_SETTINGS.auto_assign_strategy,
        auto_assign_priorities: normalizePriorities(data.auto_assign_priorities as TicketPriority[]),
        last_round_robin_index: data.last_round_robin_index ?? DEFAULT_SETTINGS.last_round_robin_index,
        sla_escalation_enabled: data.sla_escalation_enabled ?? DEFAULT_SETTINGS.sla_escalation_enabled,
        stale_reassign_enabled: data.stale_reassign_enabled ?? DEFAULT_SETTINGS.stale_reassign_enabled,
        stale_reassign_hours: data.stale_reassign_hours ?? DEFAULT_SETTINGS.stale_reassign_hours,
        updated_at: data.updated_at,
    };
}

const getAssignableAdmins = async (adminClient = createAdminClient()): Promise<AssignableAdmin[]> => {
    if (isDrizzleEnabled()) {
        try {
            const rows = await drizzleGetAssignableAdmins();
            return rows.map((row) => ({
                id: row.id,
                email: row.email,
                display_name: row.display_name,
                role: row.role as Database['public']['Enums']['admin_role'],
            }));
        } catch (error) {
            console.error('Error fetching assignable admins (drizzle):', error);
            return [];
        }
    }

    const { data, error } = await adminClient
        .from('admin_users')
        .select('id, email, display_name, role')
        .eq('is_active', true)
        .in('role', ASSIGNABLE_ROLES);

    if (error) {
        console.error('Error fetching assignable admins:', error?.message || error);
        return [];
    }

    return (data || []) as AssignableAdmin[];
};

const getUnassignedTickets = async (adminClient: ReturnType<typeof createAdminClient>, input: {
    priorities: TicketPriority[];
    ticketIds?: string[];
}): Promise<AssignableTicket[]> => {
    if (isDrizzleEnabled()) {
        try {
            const rows = await drizzleGetUnassignedTickets({
                priorities: input.priorities,
                ticketIds: input.ticketIds,
            });
            return rows as AssignableTicket[];
        } catch (error) {
            console.error('Error fetching unassigned tickets (drizzle):', error);
            return [];
        }
    }

    let query = adminClient
        .from('support_tickets')
        .select('id, priority, status, created_at')
        .is('assigned_admin_id', null)
        .in('status', ACTIVE_STATUSES);

    if (input.ticketIds && input.ticketIds.length > 0) {
        query = query.in('id', input.ticketIds);
    }

    if (input.priorities.length > 0) {
        query = query.in('priority', input.priorities);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching unassigned tickets:', error?.message || error);
        return [];
    }

    return (data || []) as AssignableTicket[];
};

export async function autoAssignTickets(params?: {
    adminClient?: ReturnType<typeof createAdminClient>;
    settings?: SupportAssignmentSettings;
    priorities?: TicketPriority[];
    strategy?: AutoAssignStrategy;
    ticketIds?: string[];
}): Promise<{ updated: number; assignments: Array<{ ticketId: string; adminId: string }> }> {
    const adminClient = params?.adminClient ?? createAdminClient();
    const settings = params?.settings ?? await getSupportAssignmentSettings(adminClient);
    const priorities = normalizePriorities(params?.priorities ?? settings.auto_assign_priorities);
    const strategy = params?.strategy ?? settings.auto_assign_strategy;

    const admins = await getAssignableAdmins(adminClient);
    if (admins.length === 0) {
        return { updated: 0, assignments: [] };
    }

    const tickets = await getUnassignedTickets(adminClient, {
        priorities,
        ticketIds: params?.ticketIds,
    });

    if (tickets.length === 0) {
        return { updated: 0, assignments: [] };
    }

    const sortedTickets = [...tickets].sort((a, b) => {
        const rankA = priorityRank.get(a.priority) ?? 99;
        const rankB = priorityRank.get(b.priority) ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let activeTickets: Array<{ id: string; assigned_admin_id: string | null }> = [];
    if (isDrizzleEnabled()) {
        try {
            activeTickets = await drizzleGetActiveAssignments(admins.map((admin) => admin.id));
        } catch (error) {
            console.error('Error fetching active ticket counts (drizzle):', error);
        }
    } else {
        const { data, error: activeError } = await adminClient
            .from('support_tickets')
            .select('id, assigned_admin_id')
            .in('assigned_admin_id', admins.map((admin) => admin.id))
            .in('status', ACTIVE_STATUSES);

        if (activeError) {
            console.error('Error fetching active ticket counts:', activeError?.message || activeError);
        }
        activeTickets = data || [];
    }

    const activeCounts = new Map<string, number>();
    admins.forEach((admin) => activeCounts.set(admin.id, 0));
    activeTickets.forEach((ticket) => {
        if (!ticket.assigned_admin_id) return;
        activeCounts.set(
            ticket.assigned_admin_id,
            (activeCounts.get(ticket.assigned_admin_id) || 0) + 1
        );
    });

    const assignments: Array<{ ticketId: string; adminId: string }> = [];
    let roundRobinIndex = settings.last_round_robin_index ?? 0;

    sortedTickets.forEach((ticket) => {
        let selectedAdmin: AssignableAdmin | undefined;

        if (strategy === 'ROUND_ROBIN') {
            const index = roundRobinIndex % admins.length;
            selectedAdmin = admins[index];
            roundRobinIndex += 1;
        } else {
            selectedAdmin = admins.reduce((best, current) => {
                const bestCount = activeCounts.get(best.id) ?? 0;
                const currentCount = activeCounts.get(current.id) ?? 0;
                if (currentCount < bestCount) {
                    return current;
                }
                return best;
            }, admins[0]);
        }

        if (!selectedAdmin) return;

        assignments.push({ ticketId: ticket.id, adminId: selectedAdmin.id });
        activeCounts.set(selectedAdmin.id, (activeCounts.get(selectedAdmin.id) || 0) + 1);
    });

    if (assignments.length === 0) {
        return { updated: 0, assignments: [] };
    }

    if (isDrizzleEnabled()) {
        try {
            await Promise.all(
                assignments.map((assignment) =>
                    drizzleAssignTicket(assignment.ticketId, assignment.adminId)
                )
            );
            if (strategy === 'ROUND_ROBIN' && settings.id) {
                await drizzleUpdateSupportSettings(settings.id, {
                    lastRoundRobinIndex: roundRobinIndex,
                });
            }
        } catch (error) {
            console.error('Error applying auto assignment (drizzle):', error);
        }
    } else {
        const results = await Promise.all(
            assignments.map((assignment) =>
                adminClient
                    .from('support_tickets')
                    .update({ assigned_admin_id: assignment.adminId })
                    .eq('id', assignment.ticketId)
            )
        );

        const failed = results.find((result) => result.error);
        if (failed?.error) {
            console.error('Error applying auto assignment:', failed.error?.message || failed.error);
        }

        if (strategy === 'ROUND_ROBIN' && settings.id) {
            await adminClient
                .from('admin_support_settings')
                .update({ last_round_robin_index: roundRobinIndex })
                .eq('id', settings.id);
        }
    }

    return { updated: assignments.length, assignments };
}

export async function autoAssignTicketIfEnabled(ticketId: string, priority: TicketPriority): Promise<{ updated: number; assignments?: Array<{ ticketId: string; adminId: string }> }> {
    const adminClient = createAdminClient();
    const settings = await getSupportAssignmentSettings(adminClient);

    if (!settings.auto_assign_enabled) {
        return { updated: 0 };
    }

    if (!settings.auto_assign_priorities.includes(priority)) {
        return { updated: 0 };
    }

    return autoAssignTickets({
        adminClient,
        settings,
        ticketIds: [ticketId],
    });
}
