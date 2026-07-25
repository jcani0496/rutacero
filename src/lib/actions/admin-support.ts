'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { hasPermission, requirePermission, logAdminAction } from '@/lib/actions/admin-auth';
import { createNotification } from '@/lib/actions/admin-notifications';
import { maskEmailAddress } from '@/lib/privacy/email';
import { getSlaState } from '@/lib/support/sla';
import {
    autoAssignTickets as runAutoAssignTickets,
    getSupportAssignmentSettings,
    type AutoAssignStrategy,
    type SupportAssignmentSettings,
} from '@/lib/support/assignment';
import type { Database, Json } from '@/types/supabase';

export type TicketStatus = Database['public']['Enums']['ticket_status'];
export type TicketPriority = Database['public']['Enums']['ticket_priority'];
export type TicketCategory = Database['public']['Enums']['ticket_category'];

export interface AdminTicket {
    id: string;
    user_id: string;
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    assigned_admin_id: string | null;
}

export interface TicketMessage {
    id: string;
    ticket_id: string;
    sender_type: string;
    sender_id: string;
    message: string;
    is_internal: boolean;
    created_at: string;
}

export interface TicketMessageStats {
    total: number;
    internal: number;
    last_sender_type: string | null;
    last_at: string | null;
    last_user_at: string | null;
    last_admin_at: string | null;
}

export interface SupportTicketLabel {
    id: string;
    ticket_id: string;
    label: string;
    created_at: string;
    created_by: string | null;
    created_by_name: string | null;
}

export interface TicketHistoryEntry {
    id: string;
    action: string;
    created_at: string;
    admin_id: string | null;
    admin_name: string | null;
    details: Record<string, unknown> | null;
}

export interface SupportMetrics {
    avg_first_response_minutes: number | null;
    active_by_priority: Record<TicketPriority, number>;
    category_distribution: Record<TicketCategory, number>;
    active_total: number;
    sla_overdue: number;
    sla_at_risk: number;
}

export type AdminSupportSettings = SupportAssignmentSettings;

export interface SupportAutomationRule {
    id: string;
    name: string;
    is_active: boolean;
    category: TicketCategory;
    plan_code: string | null;
    set_priority: TicketPriority | null;
    assign_role: Database['public']['Enums']['admin_role'] | null;
    created_at: string;
    updated_at: string;
}

export interface SavedViewFilters {
    queueFilter?: string;
    statusFilter?: TicketStatus | 'ALL';
    priorityFilter?: TicketPriority | 'ALL';
    assigneeFilter?: 'ALL' | 'ME' | 'UNASSIGNED';
    search?: string;
}

export interface AdminSavedView {
    id: string;
    name: string;
    filters: SavedViewFilters;
    created_at: string;
}

export interface SupportAgentMetric {
    id: string;
    email: string;
    display_name: string | null;
    role: Database['public']['Enums']['admin_role'];
    assigned_total: number;
    active_total: number;
    resolved_30d: number;
    avg_first_response_minutes: number | null;
    sla_overdue: number;
    sla_at_risk: number;
}

type SupportAlertType = 'SLA_OVERDUE' | 'SLA_AT_RISK' | 'UNASSIGNED';

export interface ReplyTemplate {
    id: string;
    title: string;
    body: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export interface AdminAssignee {
    id: string;
    email: string;
    display_name: string | null;
    role: Database['public']['Enums']['admin_role'];
    is_active: boolean;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_USER'];
const ASSIGNABLE_ROLES: Database['public']['Enums']['admin_role'][] = [
    'SUPER_ADMIN',
    'ADMIN',
    'SUPPORT',
];
const ALERT_LOOKBACK_HOURS = 24;
const ALERT_ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS'];

const toJsonFilters = (filters: SavedViewFilters): Json => {
    const entries = Object.entries(filters || {}).filter(([, value]) => value !== undefined);
    return Object.fromEntries(entries) as Json;
};

export async function getAdminTickets(): Promise<AdminTicket[]> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from('support_tickets')
        .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_admin_id')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching admin tickets:', error?.message || error);
        return [];
    }

    return (data || []) as AdminTicket[];
}

const buildTicketMessageStats = (messages: Array<{
    ticket_id: string;
    sender_type: string;
    is_internal: boolean;
    created_at: string;
}>): Record<string, TicketMessageStats> => {
    const messageStats: Record<string, TicketMessageStats> = {};

    messages.forEach((message) => {
        if (!messageStats[message.ticket_id]) {
            messageStats[message.ticket_id] = {
                total: 0,
                internal: 0,
                last_sender_type: null,
                last_at: null,
                last_user_at: null,
                last_admin_at: null,
            };
        }

        const stats = messageStats[message.ticket_id];
        stats.total += 1;
        if (message.is_internal) {
            stats.internal += 1;
        }

        const createdAt = message.created_at;

        if (!stats.last_at || new Date(createdAt).getTime() > new Date(stats.last_at).getTime()) {
            stats.last_at = createdAt;
            stats.last_sender_type = message.sender_type;
        }

        if (message.sender_type === 'USER') {
            if (!stats.last_user_at || new Date(createdAt).getTime() > new Date(stats.last_user_at).getTime()) {
                stats.last_user_at = createdAt;
            }
        }

        if (message.sender_type === 'ADMIN') {
            if (!stats.last_admin_at || new Date(createdAt).getTime() > new Date(stats.last_admin_at).getTime()) {
                stats.last_admin_at = createdAt;
            }
        }
    });

    return messageStats;
};

export async function getAdminTicketListData(): Promise<{
    tickets: AdminTicket[];
    messageStats: Record<string, TicketMessageStats>;
}> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const { data: tickets, error } = await adminClient
        .from('support_tickets')
        .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_admin_id')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching admin tickets:', error?.message || error);
        return { tickets: [], messageStats: {} };
    }

    const safeTickets = (tickets || []) as AdminTicket[];
    const ticketIds = safeTickets.map((ticket) => ticket.id);

    if (ticketIds.length === 0) {
        return { tickets: safeTickets, messageStats: {} };
    }

    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('ticket_id, sender_type, is_internal, created_at')
        .in('ticket_id', ticketIds);

    if (messageError) {
        console.error('Error fetching ticket message stats:', messageError?.message || messageError);
        return { tickets: safeTickets, messageStats: {} };
    }

    return { tickets: safeTickets, messageStats: buildTicketMessageStats(messages || []) };
}

export async function getAdminSupportMetrics(): Promise<SupportMetrics> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const emptyMetrics: SupportMetrics = {
        avg_first_response_minutes: null,
        active_by_priority: {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            URGENT: 0,
        },
        category_distribution: {
            TECHNICAL: 0,
            BILLING: 0,
            ACCOUNT: 0,
            FEATURE_REQUEST: 0,
            OTHER: 0,
        },
        active_total: 0,
        sla_overdue: 0,
        sla_at_risk: 0,
    };

    const { data: tickets, error } = await adminClient
        .from('support_tickets')
        .select('id, status, priority, category, created_at, updated_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching support metrics tickets:', error?.message || error);
        return emptyMetrics;
    }

    const safeTickets = (tickets || []) as Array<{
        id: string;
        status: TicketStatus;
        priority: TicketPriority;
        category: TicketCategory;
        created_at: string;
        updated_at: string;
    }>;

    const ticketIds: string[] = [];
    safeTickets.forEach((ticket) => {
        ticketIds.push(ticket.id);
        if (ACTIVE_STATUSES.includes(ticket.status)) {
            emptyMetrics.active_total += 1;
            emptyMetrics.active_by_priority[ticket.priority] += 1;
            emptyMetrics.category_distribution[ticket.category] += 1;
        }
    });

    if (ticketIds.length === 0) {
        return emptyMetrics;
    }

    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('ticket_id, sender_type, created_at')
        .in('ticket_id', ticketIds);

    if (messageError) {
        console.error('Error fetching support metrics messages:', messageError?.message || messageError);
        return emptyMetrics;
    }

    const timeline = new Map<string, { firstUser?: string; firstAdmin?: string }>();

    (messages || []).forEach((message) => {
        if (!timeline.has(message.ticket_id)) {
            timeline.set(message.ticket_id, {});
        }
        const entry = timeline.get(message.ticket_id);
        if (!entry) {
            return;
        }

        if (message.sender_type === 'USER') {
            if (!entry.firstUser || new Date(message.created_at).getTime() < new Date(entry.firstUser).getTime()) {
                entry.firstUser = message.created_at;
            }
        }
        if (message.sender_type === 'ADMIN') {
            if (!entry.firstAdmin || new Date(message.created_at).getTime() < new Date(entry.firstAdmin).getTime()) {
                entry.firstAdmin = message.created_at;
            }
        }
    });

    let totalMinutes = 0;
    let samples = 0;
    timeline.forEach((entry) => {
        if (!entry.firstUser || !entry.firstAdmin) {
            return;
        }
        const diffMinutes = (new Date(entry.firstAdmin).getTime() - new Date(entry.firstUser).getTime()) / 60000;
        if (diffMinutes >= 0) {
            totalMinutes += diffMinutes;
            samples += 1;
        }
    });

    emptyMetrics.avg_first_response_minutes = samples > 0 ? Math.round(totalMinutes / samples) : null;

    const messageStats = buildTicketMessageStats(
        (messages || []).map((message) => ({
            ticket_id: message.ticket_id,
            sender_type: message.sender_type,
            is_internal: false,
            created_at: message.created_at,
        }))
    );

    safeTickets.forEach((ticket) => {
        if (!ACTIVE_STATUSES.includes(ticket.status)) {
            return;
        }
        const stats = messageStats[ticket.id];
        const sla = getSlaState({
            priority: ticket.priority,
            status: ticket.status,
            lastUserAt: stats?.last_user_at || null,
            lastAdminAt: stats?.last_admin_at || null,
        });

        if (sla.status === 'OVERDUE') {
            emptyMetrics.sla_overdue += 1;
        }
        if (sla.status === 'AT_RISK') {
            emptyMetrics.sla_at_risk += 1;
        }
    });

    return emptyMetrics;
}

export async function syncSupportAlerts(): Promise<{ success: boolean; created?: number; error?: string }> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const { data: admins, error: adminError } = await adminClient
        .from('admin_users')
        .select('id, role, is_active')
        .eq('is_active', true)
        .in('role', ASSIGNABLE_ROLES);

    if (adminError || !admins?.length) {
        if (adminError) {
            console.error('Error fetching admins for alerts:', adminError?.message || adminError);
        }
        return { success: true, created: 0 };
    }

    const { data: tickets, error: ticketError } = await adminClient
        .from('support_tickets')
        .select('id, subject, priority, status, assigned_admin_id, updated_at')
        .in('status', ALERT_ACTIVE_STATUSES);

    if (ticketError) {
        console.error('Error fetching tickets for alerts:', ticketError?.message || ticketError);
        return { success: false, error: 'No se pudieron generar las alertas.' };
    }

    const safeTickets = (tickets || []) as Array<{
        id: string;
        subject: string;
        priority: TicketPriority;
        status: TicketStatus;
        assigned_admin_id: string | null;
        updated_at: string;
    }>;

    if (safeTickets.length === 0) {
        return { success: true, created: 0 };
    }

    const ticketIds = safeTickets.map((ticket) => ticket.id);
    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('ticket_id, sender_type, is_internal, created_at')
        .in('ticket_id', ticketIds);

    if (messageError) {
        console.error('Error fetching ticket messages for alerts:', messageError?.message || messageError);
        return { success: false, error: 'No se pudieron generar las alertas.' };
    }

    const messageStats = buildTicketMessageStats(messages || []);
    const alerts: Array<{
        alertType: SupportAlertType;
        ticketId: string;
        subject: string;
        priority: TicketPriority;
        status: TicketStatus;
        assignedAdminId: string | null;
    }> = [];

    safeTickets.forEach((ticket) => {
        const stats = messageStats[ticket.id];
        const sla = getSlaState({
            priority: ticket.priority,
            status: ticket.status,
            lastUserAt: stats?.last_user_at || null,
            lastAdminAt: stats?.last_admin_at || null,
        });

        if (sla.status === 'OVERDUE') {
            alerts.push({
                alertType: 'SLA_OVERDUE',
                ticketId: ticket.id,
                subject: ticket.subject,
                priority: ticket.priority,
                status: ticket.status,
                assignedAdminId: ticket.assigned_admin_id,
            });
        } else if (sla.status === 'AT_RISK') {
            alerts.push({
                alertType: 'SLA_AT_RISK',
                ticketId: ticket.id,
                subject: ticket.subject,
                priority: ticket.priority,
                status: ticket.status,
                assignedAdminId: ticket.assigned_admin_id,
            });
        }

        if (!ticket.assigned_admin_id) {
            alerts.push({
                alertType: 'UNASSIGNED',
                ticketId: ticket.id,
                subject: ticket.subject,
                priority: ticket.priority,
                status: ticket.status,
                assignedAdminId: null,
            });
        }
    });

    if (alerts.length === 0) {
        return { success: true, created: 0 };
    }

    const since = new Date(Date.now() - ALERT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notificationsTable = (adminClient as any).from('admin_notifications');

    const { data: recentNotifications, error: notificationError } = await notificationsTable
        .select('id, admin_id, created_at, metadata')
        .eq('type', 'SYSTEM_ALERT')
        .gte('created_at', since);

    if (notificationError) {
        console.error('Error fetching recent notifications:', notificationError?.message || notificationError);
    }

    const existingKeys = new Set<string>();
    (recentNotifications || []).forEach((notification: { admin_id: string; metadata: Record<string, unknown> | null }) => {
        const metadata = notification.metadata || {};
        const alertKey = typeof metadata.alert_key === 'string' ? metadata.alert_key : null;
        if (!alertKey) return;
        existingKeys.add(`${notification.admin_id}:${alertKey}`);
    });

    const inserts: Array<Record<string, unknown>> = [];
    alerts.forEach((alert) => {
        const recipients = alert.assignedAdminId
            ? admins.filter((admin) => admin.id === alert.assignedAdminId)
            : admins;

        recipients.forEach((admin) => {
            const alertKey = `${alert.alertType}:${alert.ticketId}`;
            const uniqueKey = `${admin.id}:${alertKey}`;
            if (existingKeys.has(uniqueKey)) {
                return;
            }

            const title = alert.alertType === 'UNASSIGNED'
                ? 'Ticket sin asignar'
                : alert.alertType === 'SLA_OVERDUE'
                    ? 'SLA vencido'
                    : 'SLA en riesgo';

            const message = `${alert.subject}`;

            inserts.push({
                admin_id: admin.id,
                type: 'SYSTEM_ALERT',
                title,
                message,
                read: false,
                metadata: {
                    alert_type: alert.alertType,
                    alert_key: alertKey,
                    ticket_id: alert.ticketId,
                    ticket_subject: alert.subject,
                    priority: alert.priority,
                    status: alert.status,
                },
            });
            existingKeys.add(uniqueKey);
        });
    });

    if (inserts.length === 0) {
        return { success: true, created: 0 };
    }

    const { error: insertError } = await notificationsTable.insert(inserts);
    if (insertError) {
        console.error('Error creating support alerts:', insertError?.message || insertError);
        return { success: false, error: 'No se pudieron crear las alertas.' };
    }

    return { success: true, created: inserts.length };
}

export async function getAdminSupportSettings(): Promise<AdminSupportSettings> {
    await requirePermission('tickets:read');
    return getSupportAssignmentSettings();
}

export async function getSupportAutomationRules(): Promise<SupportAutomationRule[]> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from('admin_support_rules')
        .select('id, name, is_active, category, plan_code, set_priority, assign_role, created_at, updated_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching support automation rules:', error?.message || error);
        return [];
    }

    return (data || []) as SupportAutomationRule[];
}

export async function createSupportAutomationRule(input: {
    name: string;
    category: TicketCategory;
    plan_code?: string | null;
    set_priority?: TicketPriority | null;
    assign_role?: Database['public']['Enums']['admin_role'] | null;
}): Promise<{ success: boolean; rule?: SupportAutomationRule; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    const name = input.name.trim();
    if (!name) {
        return { success: false, error: 'El nombre es obligatorio.' };
    }

    if (!input.set_priority && !input.assign_role) {
        return { success: false, error: 'Define prioridad o asignación.' };
    }

    const { data, error } = await adminClient
        .from('admin_support_rules')
        .insert({
            name,
            category: input.category,
            plan_code: input.plan_code || null,
            set_priority: input.set_priority || null,
            assign_role: input.assign_role || null,
        })
        .select('id, name, is_active, category, plan_code, set_priority, assign_role, created_at, updated_at')
        .single();

    if (error || !data) {
        console.error('Error creating support rule:', error?.message || error);
        return { success: false, error: 'No se pudo crear la regla.' };
    }

    await logAdminAction(session.adminId, 'CREATE_SUPPORT_RULE', 'admin_support_rules', data.id, {
        category: data.category,
        plan_code: data.plan_code,
        set_priority: data.set_priority,
        assign_role: data.assign_role,
    });

    return { success: true, rule: data as SupportAutomationRule };
}

export async function toggleSupportAutomationRule(ruleId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!ruleId || !isUuid(ruleId)) {
        return { success: false, error: 'Regla inválida.' };
    }

    const { error } = await adminClient
        .from('admin_support_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

    if (error) {
        console.error('Error updating support rule:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar la regla.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_SUPPORT_RULE', 'admin_support_rules', ruleId, {
        is_active: isActive,
    });

    return { success: true };
}

export async function deleteSupportAutomationRule(ruleId: string): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!ruleId || !isUuid(ruleId)) {
        return { success: false, error: 'Regla inválida.' };
    }

    const { error } = await adminClient
        .from('admin_support_rules')
        .delete()
        .eq('id', ruleId);

    if (error) {
        console.error('Error deleting support rule:', error?.message || error);
        return { success: false, error: 'No se pudo eliminar la regla.' };
    }

    await logAdminAction(session.adminId, 'DELETE_SUPPORT_RULE', 'admin_support_rules', ruleId);

    return { success: true };
}

export async function updateAdminSupportSettings(input: {
    auto_assign_enabled?: boolean;
    auto_assign_strategy?: AutoAssignStrategy;
    auto_assign_priorities?: TicketPriority[];
    sla_escalation_enabled?: boolean;
    stale_reassign_enabled?: boolean;
    stale_reassign_hours?: number;
}): Promise<{ success: boolean; settings?: AdminSupportSettings; error?: string }> {
    const session = await requirePermission('tickets:assign');
    const adminClient = createAdminClient();
    const current = await getSupportAssignmentSettings(adminClient);

    const updates: Record<string, unknown> = {};
    if (typeof input.auto_assign_enabled === 'boolean') {
        updates.auto_assign_enabled = input.auto_assign_enabled;
    }
    if (input.auto_assign_strategy) {
        updates.auto_assign_strategy = input.auto_assign_strategy;
    }
    if (input.auto_assign_priorities && input.auto_assign_priorities.length > 0) {
        updates.auto_assign_priorities = input.auto_assign_priorities;
    }
    if (typeof input.sla_escalation_enabled === 'boolean') {
        updates.sla_escalation_enabled = input.sla_escalation_enabled;
    }
    if (typeof input.stale_reassign_enabled === 'boolean') {
        updates.stale_reassign_enabled = input.stale_reassign_enabled;
    }
    if (typeof input.stale_reassign_hours === 'number' && !Number.isNaN(input.stale_reassign_hours)) {
        updates.stale_reassign_hours = Math.max(1, Math.round(input.stale_reassign_hours));
    }

    if (!Object.keys(updates).length) {
        return { success: false, error: 'No hay cambios para guardar.' };
    }

    const { data, error } = await adminClient
        .from('admin_support_settings')
        .update(updates)
        .eq('id', current.id)
        .select('id, auto_assign_enabled, auto_assign_strategy, auto_assign_priorities, last_round_robin_index, sla_escalation_enabled, stale_reassign_enabled, stale_reassign_hours, updated_at')
        .single();

    if (error || !data) {
        console.error('Error updating support settings:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar la configuración.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_SUPPORT_SETTINGS', 'admin_support_settings', current.id, updates);

    return {
        success: true,
        settings: {
            id: data.id,
            auto_assign_enabled: data.auto_assign_enabled,
            auto_assign_strategy: data.auto_assign_strategy as AutoAssignStrategy,
            auto_assign_priorities: (data.auto_assign_priorities || []) as TicketPriority[],
            last_round_robin_index: data.last_round_robin_index,
            sla_escalation_enabled: data.sla_escalation_enabled ?? false,
            stale_reassign_enabled: data.stale_reassign_enabled ?? false,
            stale_reassign_hours: data.stale_reassign_hours ?? 24,
            updated_at: data.updated_at,
        },
    };
}

export async function autoAssignSupportTickets(input?: {
    priorities?: TicketPriority[];
    strategy?: AutoAssignStrategy;
    force?: boolean;
}): Promise<{ success: boolean; updated?: number; assignments?: Array<{ ticketId: string; adminId: string }>; error?: string }> {
    const session = await requirePermission('tickets:assign');
    const adminClient = createAdminClient();
    const settings = await getSupportAssignmentSettings(adminClient);

    if (!settings.auto_assign_enabled && !input?.force) {
        return { success: false, error: 'La auto-asignación está desactivada.' };
    }

    const result = await runAutoAssignTickets({
        adminClient,
        settings,
        priorities: input?.priorities,
        strategy: input?.strategy,
    });

    if (result.updated > 0) {
        await logAdminAction(session.adminId, 'AUTO_ASSIGN_TICKETS', 'support_tickets', undefined, {
            updated: result.updated,
            strategy: input?.strategy ?? settings.auto_assign_strategy,
            priorities: input?.priorities ?? settings.auto_assign_priorities,
        });
    }

    return { success: true, updated: result.updated, assignments: result.assignments };
}

export async function getAdminSavedViews(): Promise<AdminSavedView[]> {
    const session = await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from('admin_saved_views')
        .select('id, name, filters, created_at')
        .eq('admin_id', session.adminId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching saved views:', error?.message || error);
        return [];
    }

    return (data || []).map((view) => ({
        id: view.id,
        name: view.name,
        filters: (view.filters || {}) as SavedViewFilters,
        created_at: view.created_at,
    }));
}

export async function createAdminSavedView(input: {
    name: string;
    filters: SavedViewFilters;
}): Promise<{ success: boolean; view?: AdminSavedView; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    const name = input.name.trim();
    if (!name) {
        return { success: false, error: 'El nombre es obligatorio.' };
    }

    const { data, error } = await adminClient
        .from('admin_saved_views')
        .insert({
            admin_id: session.adminId,
            name,
            filters: toJsonFilters(input.filters || {}),
        })
        .select('id, name, filters, created_at')
        .single();

    if (error || !data) {
        console.error('Error creating saved view:', error?.message || error);
        return { success: false, error: 'No se pudo guardar la vista.' };
    }

    await logAdminAction(session.adminId, 'CREATE_SAVED_VIEW', 'admin_saved_views', data.id, {
        name,
    });

    return {
        success: true,
        view: {
            id: data.id,
            name: data.name,
            filters: (data.filters || {}) as SavedViewFilters,
            created_at: data.created_at,
        },
    };
}

export async function deleteAdminSavedView(viewId: string): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!viewId || !isUuid(viewId)) {
        return { success: false, error: 'Vista inválida.' };
    }

    const { error } = await adminClient
        .from('admin_saved_views')
        .delete()
        .eq('id', viewId)
        .eq('admin_id', session.adminId);

    if (error) {
        console.error('Error deleting saved view:', error?.message || error);
        return { success: false, error: 'No se pudo eliminar la vista.' };
    }

    await logAdminAction(session.adminId, 'DELETE_SAVED_VIEW', 'admin_saved_views', viewId);

    return { success: true };
}

export async function getSupportAgentMetrics(): Promise<SupportAgentMetric[]> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    const { data: admins, error: adminError } = await adminClient
        .from('admin_users')
        .select('id, email, display_name, role, is_active')
        .eq('is_active', true)
        .in('role', ASSIGNABLE_ROLES);

    if (adminError) {
        console.error('Error fetching support agents:', adminError?.message || adminError);
        return [];
    }

    const activeAdmins = (admins || []) as Array<{
        id: string;
        email: string;
        display_name: string | null;
        role: Database['public']['Enums']['admin_role'];
    }>;

    if (activeAdmins.length === 0) {
        return [];
    }

    const adminIds = activeAdmins.map((admin) => admin.id);
    const { data: tickets, error: ticketError } = await adminClient
        .from('support_tickets')
        .select('id, assigned_admin_id, status, priority, created_at, resolved_at')
        .in('assigned_admin_id', adminIds);

    if (ticketError) {
        console.error('Error fetching assigned tickets:', ticketError?.message || ticketError);
        return [];
    }

    const safeTickets = (tickets || []) as Array<{
        id: string;
        assigned_admin_id: string | null;
        status: TicketStatus;
        priority: TicketPriority;
        created_at: string;
        resolved_at: string | null;
    }>;

    const ticketIds = safeTickets.map((ticket) => ticket.id);
    const metricsMap = new Map<string, SupportAgentMetric>();

    activeAdmins.forEach((admin) => {
        metricsMap.set(admin.id, {
            id: admin.id,
            email: admin.email,
            display_name: admin.display_name,
            role: admin.role,
            assigned_total: 0,
            active_total: 0,
            resolved_30d: 0,
            avg_first_response_minutes: null,
            sla_overdue: 0,
            sla_at_risk: 0,
        });
    });

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();

    safeTickets.forEach((ticket) => {
        if (!ticket.assigned_admin_id) {
            return;
        }
        const metric = metricsMap.get(ticket.assigned_admin_id);
        if (!metric) return;

        metric.assigned_total += 1;
        if (ACTIVE_STATUSES.includes(ticket.status)) {
            metric.active_total += 1;
        }
        if (ticket.resolved_at && new Date(ticket.resolved_at).getTime() >= cutoff) {
            metric.resolved_30d += 1;
        }
    });

    if (ticketIds.length === 0) {
        return Array.from(metricsMap.values());
    }

    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('ticket_id, sender_type, created_at')
        .in('ticket_id', ticketIds);

    if (messageError) {
        console.error('Error fetching ticket messages for metrics:', messageError?.message || messageError);
        return Array.from(metricsMap.values());
    }

    const messageStats = buildTicketMessageStats(
        (messages || []).map((message) => ({
            ticket_id: message.ticket_id,
            sender_type: message.sender_type,
            is_internal: false,
            created_at: message.created_at,
        }))
    );

    const timeline = new Map<string, { firstUser?: string; firstAdmin?: string }>();
    (messages || []).forEach((message) => {
        if (!timeline.has(message.ticket_id)) {
            timeline.set(message.ticket_id, {});
        }
        const entry = timeline.get(message.ticket_id);
        if (!entry) return;

        if (message.sender_type === 'USER') {
            if (!entry.firstUser || new Date(message.created_at).getTime() < new Date(entry.firstUser).getTime()) {
                entry.firstUser = message.created_at;
            }
        }
        if (message.sender_type === 'ADMIN') {
            if (!entry.firstAdmin || new Date(message.created_at).getTime() < new Date(entry.firstAdmin).getTime()) {
                entry.firstAdmin = message.created_at;
            }
        }
    });

    const responseTotals = new Map<string, { totalMinutes: number; samples: number }>();
    safeTickets.forEach((ticket) => {
        if (!ticket.assigned_admin_id) {
            return;
        }
        const metric = metricsMap.get(ticket.assigned_admin_id);
        if (!metric) return;

        const stats = messageStats[ticket.id];
        const sla = getSlaState({
            priority: ticket.priority,
            status: ticket.status,
            lastUserAt: stats?.last_user_at || null,
            lastAdminAt: stats?.last_admin_at || null,
        });

        if (sla.status === 'OVERDUE') {
            metric.sla_overdue += 1;
        }
        if (sla.status === 'AT_RISK') {
            metric.sla_at_risk += 1;
        }

        const timelineEntry = timeline.get(ticket.id);
        if (timelineEntry?.firstUser && timelineEntry?.firstAdmin) {
            const diffMinutes = (new Date(timelineEntry.firstAdmin).getTime() - new Date(timelineEntry.firstUser).getTime()) / 60000;
            if (diffMinutes >= 0) {
                const current = responseTotals.get(ticket.assigned_admin_id) ?? { totalMinutes: 0, samples: 0 };
                current.totalMinutes += diffMinutes;
                current.samples += 1;
                responseTotals.set(ticket.assigned_admin_id, current);
            }
        }
    });

    responseTotals.forEach((value, adminId) => {
        const metric = metricsMap.get(adminId);
        if (!metric) return;
        metric.avg_first_response_minutes = value.samples > 0 ? Math.round(value.totalMinutes / value.samples) : null;
    });

    return Array.from(metricsMap.values());
}

export async function getReplyTemplates(includeInactive: boolean = false): Promise<ReplyTemplate[]> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    let query = adminClient
        .from('admin_reply_templates')
        .select('id, title, body, is_active, created_at, updated_at, created_by')
        .order('created_at', { ascending: false });

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching reply templates:', error?.message || error);
        return [];
    }

    return (data || []) as ReplyTemplate[];
}

export async function createReplyTemplate(input: {
    title: string;
    body: string;
    is_active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    const title = input.title.trim();
    const body = input.body.trim();

    if (!title || !body) {
        return { success: false, error: 'Completa el titulo y el contenido.' };
    }

    const { error } = await adminClient
        .from('admin_reply_templates')
        .insert({
            title,
            body,
            is_active: input.is_active ?? true,
            created_by: session.adminId,
        });

    if (error) {
        console.error('Error creating reply template:', error?.message || error);
        return { success: false, error: 'No se pudo crear la plantilla.' };
    }

    await logAdminAction(session.adminId, 'CREATE_REPLY_TEMPLATE', 'admin_reply_templates', undefined, {
        title,
    });

    return { success: true };
}

export async function updateReplyTemplate(input: {
    id: string;
    title?: string;
    body?: string;
    is_active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!input.id || !isUuid(input.id)) {
        return { success: false, error: 'Plantilla inválida.' };
    }

    const updates: Record<string, unknown> = {};
    if (typeof input.title === 'string') {
        const title = input.title.trim();
        if (!title) {
            return { success: false, error: 'El título no puede estar vacío.' };
        }
        updates.title = title;
    }
    if (typeof input.body === 'string') {
        const body = input.body.trim();
        if (!body) {
            return { success: false, error: 'El contenido no puede estar vacío.' };
        }
        updates.body = body;
    }
    if (typeof input.is_active === 'boolean') {
        updates.is_active = input.is_active;
    }

    if (!Object.keys(updates).length) {
        return { success: false, error: 'Sin cambios para aplicar.' };
    }

    const { error } = await adminClient
        .from('admin_reply_templates')
        .update(updates)
        .eq('id', input.id);

    if (error) {
        console.error('Error updating reply template:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar la plantilla.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_REPLY_TEMPLATE', 'admin_reply_templates', input.id, updates);

    return { success: true };
}

export async function deleteReplyTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!id || !isUuid(id)) {
        return { success: false, error: 'Plantilla inválida.' };
    }

    const { error } = await adminClient
        .from('admin_reply_templates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting reply template:', error?.message || error);
        return { success: false, error: 'No se pudo eliminar la plantilla.' };
    }

    await logAdminAction(session.adminId, 'DELETE_REPLY_TEMPLATE', 'admin_reply_templates', id);

    return { success: true };
}

export async function bulkUpdateTickets(input: {
    ticketIds: string[];
    status?: TicketStatus;
    priority?: TicketPriority;
    assigned_admin_id?: string | null;
}): Promise<{ success: boolean; error?: string; updated?: number }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    const validIds = (input.ticketIds || []).filter((id) => isUuid(id));
    if (validIds.length === 0) {
        return { success: false, error: 'No hay tickets válidos.' };
    }

    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;
    if (input.priority) updates.priority = input.priority;
    if (typeof input.assigned_admin_id !== 'undefined') {
        updates.assigned_admin_id = input.assigned_admin_id;
    }

    if (!Object.keys(updates).length) {
        return { success: false, error: 'Selecciona al menos una acción.' };
    }

    const { data, error } = await adminClient
        .from('support_tickets')
        .update(updates)
        .in('id', validIds)
        .select('id');

    if (error) {
        console.error('Error bulk updating tickets:', error?.message || error);
        return { success: false, error: 'No se pudieron actualizar los tickets.' };
    }

    await logAdminAction(session.adminId, 'BULK_UPDATE_TICKETS', 'support_tickets', undefined, {
        ticket_ids: validIds,
        updates,
    });

    return { success: true, updated: data?.length || validIds.length };
}

export async function applySlaEscalations(input?: { force?: boolean }): Promise<{ success: boolean; updated?: number; updates?: Array<{ id: string; priority: TicketPriority }>; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();
    const settings = await getSupportAssignmentSettings(adminClient);

    if (!settings.sla_escalation_enabled && !input?.force) {
        return { success: false, error: 'El escalamiento SLA está desactivado.' };
    }

    const { data: tickets, error } = await adminClient
        .from('support_tickets')
        .select('id, status, priority')
        .in('status', ['OPEN', 'IN_PROGRESS']);

    if (error) {
        console.error('Error fetching tickets for SLA escalation:', error?.message || error);
        return { success: false, error: 'No se pudo evaluar el SLA.' };
    }

    const ticketIds = (tickets || []).map((ticket) => ticket.id);
    if (ticketIds.length === 0) {
        return { success: true, updated: 0, updates: [] };
    }

    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('ticket_id, sender_type, is_internal, created_at')
        .in('ticket_id', ticketIds);

    if (messageError) {
        console.error('Error fetching messages for SLA escalation:', messageError?.message || messageError);
        return { success: false, error: 'No se pudo evaluar el SLA.' };
    }

    const messageStats = buildTicketMessageStats(messages || []);
    const priorityOrder: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const updates: Array<{ id: string; priority: TicketPriority }> = [];

    (tickets || []).forEach((ticket) => {
        const priority = priorityOrder.includes(ticket.priority as TicketPriority)
            ? (ticket.priority as TicketPriority)
            : 'LOW';
        const status = ticket.status as TicketStatus;
        const stats = messageStats[ticket.id];
        const sla = getSlaState({
            priority,
            status,
            lastUserAt: stats?.last_user_at || null,
            lastAdminAt: stats?.last_admin_at || null,
        });

        if (sla.status !== 'OVERDUE') {
            return;
        }

        const currentIndex = priorityOrder.indexOf(priority);
        if (currentIndex >= 0 && currentIndex < priorityOrder.length - 1) {
            updates.push({ id: ticket.id, priority: priorityOrder[currentIndex + 1] });
        }
    });

    if (!updates.length) {
        return { success: true, updated: 0, updates: [] };
    }

    const updateResults = await Promise.all(
        updates.map((item) =>
            adminClient
                .from('support_tickets')
                .update({ priority: item.priority })
                .eq('id', item.id)
        )
    );

    const failed = updateResults.find((result) => result.error);
    if (failed?.error) {
        console.error('Error applying SLA escalation:', failed.error?.message || failed.error);
        return { success: false, error: 'No se pudo aplicar el escalamiento.' };
    }

    await logAdminAction(session.adminId, 'SLA_ESCALATION', 'support_tickets', undefined, {
        count: updates.length,
        ticket_ids: updates.map((item) => item.id),
        automated: settings.sla_escalation_enabled && !input?.force ? true : false,
    });

    return { success: true, updated: updates.length, updates };
}

export async function reassignStaleTickets(input?: { force?: boolean; thresholdHours?: number }): Promise<{
    success: boolean;
    updated?: number;
    assignments?: Array<{ ticketId: string; adminId: string }>;
    error?: string;
}> {
    const session = await requirePermission('tickets:assign');
    const adminClient = createAdminClient();
    const settings = await getSupportAssignmentSettings(adminClient);

    if (!settings.stale_reassign_enabled && !input?.force) {
        return { success: false, error: 'La reasignación automática está desactivada.' };
    }

    const thresholdHours = Math.max(1, Math.round(input?.thresholdHours ?? settings.stale_reassign_hours ?? 24));
    const thresholdMs = thresholdHours * 60 * 60 * 1000;

    const { data: tickets, error } = await adminClient
        .from('support_tickets')
        .select('id, status, priority, assigned_admin_id, created_at')
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .not('assigned_admin_id', 'is', null);

    if (error) {
        console.error('Error fetching stale tickets:', error?.message || error);
        return { success: false, error: 'No se pudieron evaluar los tickets.' };
    }

    const ticketIds = (tickets || []).map((ticket) => ticket.id);
    if (ticketIds.length === 0) {
        return { success: true, updated: 0, assignments: [] };
    }

    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('ticket_id, sender_type, is_internal, created_at')
        .in('ticket_id', ticketIds);

    if (messageError) {
        console.error('Error fetching messages for stale reassignment:', messageError?.message || messageError);
        return { success: false, error: 'No se pudieron evaluar los tickets.' };
    }

    const messageStats = buildTicketMessageStats(messages || []);
    const now = Date.now();
    const staleTicketIds = (tickets || []).filter((ticket) => {
        const stats = messageStats[ticket.id];
        const lastUserAt = stats?.last_user_at ? new Date(stats.last_user_at).getTime() : new Date(ticket.created_at).getTime();
        const lastAdminAt = stats?.last_admin_at ? new Date(stats.last_admin_at).getTime() : 0;
        const userWaiting = lastUserAt > lastAdminAt;
        const waitingMs = now - lastUserAt;
        return userWaiting && waitingMs >= thresholdMs;
    }).map((ticket) => ticket.id);

    if (!staleTicketIds.length) {
        return { success: true, updated: 0, assignments: [] };
    }

    const { error: unassignError } = await adminClient
        .from('support_tickets')
        .update({ assigned_admin_id: null })
        .in('id', staleTicketIds);

    if (unassignError) {
        console.error('Error unassigning stale tickets:', unassignError?.message || unassignError);
        return { success: false, error: 'No se pudo liberar la asignación.' };
    }

    const result = await runAutoAssignTickets({
        adminClient,
        settings,
        ticketIds: staleTicketIds,
        priorities: settings.auto_assign_priorities,
        strategy: settings.auto_assign_strategy,
    });

    if (result.assignments?.length) {
        await Promise.all(result.assignments.map((assignment) =>
            createNotification(
                assignment.adminId,
                'SYSTEM_ALERT',
                'Ticket reasignado',
                'Tienes un ticket reasignado por inactividad.',
                { ticket_id: assignment.ticketId }
            )
        ));
    }

    await logAdminAction(session.adminId, 'STALE_REASSIGN', 'support_tickets', undefined, {
        count: staleTicketIds.length,
        threshold_hours: thresholdHours,
        ticket_ids: staleTicketIds,
        automated: settings.stale_reassign_enabled && !input?.force ? true : false,
    });

    return { success: true, updated: result.updated, assignments: result.assignments };
}

export async function getAdminTicketDetail(ticketId: string): Promise<{
    ticket: AdminTicket;
    messages: TicketMessage[];
    userEmail: string | null;
} | null> {
    const session = await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return null;
    }

    const { data: ticket, error } = await adminClient
        .from('support_tickets')
        .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_admin_id')
        .eq('id', ticketId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching admin ticket:', error?.message || error);
        return null;
    }

    if (!ticket) {
        return null;
    }

    const { data: messages, error: messageError } = await adminClient
        .from('ticket_messages')
        .select('id, ticket_id, sender_type, sender_id, message, is_internal, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (messageError) {
        console.error('Error fetching admin ticket messages:', messageError?.message || messageError);
    }

    let userEmail: string | null = null;
    try {
        if (ticket.user_id) {
            const { getIdentityUserById } = await import('@/lib/auth/identity');
            const identityUser = await getIdentityUserById(ticket.user_id);
            const rawEmail = identityUser?.email || null;
            userEmail = session.role === 'SUPER_ADMIN' ? rawEmail : maskEmailAddress(rawEmail);
        }
    } catch {
        userEmail = null;
    }

    return {
        ticket: ticket as AdminTicket,
        messages: (messages || []) as TicketMessage[],
        userEmail,
    };
}

export async function getAdminTicketLabels(ticketId: string): Promise<SupportTicketLabel[]> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return [];
    }

    const { data, error } = await adminClient
        .from('support_ticket_labels')
        .select('id, ticket_id, label, created_at, created_by, admin_users (display_name, email)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching ticket labels:', error?.message || error);
        return [];
    }

    const rows = (data || []) as Array<{
        id: string;
        ticket_id: string;
        label: string;
        created_at: string;
        created_by: string | null;
        admin_users?: { display_name?: string | null; email?: string | null } | { display_name?: string | null; email?: string | null }[] | null;
    }>;

    return rows.map((row) => {
        const admin = Array.isArray(row.admin_users) ? row.admin_users[0] : row.admin_users;
        return {
            id: row.id,
            ticket_id: row.ticket_id,
            label: row.label,
            created_at: row.created_at,
            created_by: row.created_by,
            created_by_name: admin?.display_name || admin?.email || null,
        };
    });
}

export async function addAdminTicketLabel(ticketId: string, label: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();
    const trimmed = label.trim();

    if (!trimmed) {
        return { success: false, error: 'La etiqueta no puede estar vacía.' };
    }

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    const { error } = await adminClient
        .from('support_ticket_labels')
        .insert({
            ticket_id: ticketId,
            label: trimmed,
            created_by: session.adminId,
        });

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'La etiqueta ya existe.' };
        }
        console.error('Error adding ticket label:', error?.message || error);
        return { success: false, error: 'No se pudo agregar la etiqueta.' };
    }

    await logAdminAction(session.adminId, 'ADD_TICKET_LABEL', 'support_tickets', ticketId, {
        label: trimmed,
    });

    return { success: true };
}

export async function removeAdminTicketLabel(labelId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!labelId || !isUuid(labelId)) {
        return { success: false, error: 'Etiqueta inválida.' };
    }

    const { data: labelRow, error: fetchError } = await adminClient
        .from('support_ticket_labels')
        .select('id, ticket_id, label')
        .eq('id', labelId)
        .maybeSingle();

    if (fetchError) {
        console.error('Error fetching ticket label:', fetchError?.message || fetchError);
    }

    const { error } = await adminClient
        .from('support_ticket_labels')
        .delete()
        .eq('id', labelId);

    if (error) {
        console.error('Error removing ticket label:', error?.message || error);
        return { success: false, error: 'No se pudo eliminar la etiqueta.' };
    }

    if (labelRow?.ticket_id) {
        await logAdminAction(session.adminId, 'REMOVE_TICKET_LABEL', 'support_tickets', labelRow.ticket_id, {
            label: labelRow.label,
        });
    }

    return { success: true };
}

export async function getAdminTicketHistory(ticketId: string): Promise<TicketHistoryEntry[]> {
    await requirePermission('tickets:read');
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return [];
    }

    const { data, error } = await adminClient
        .from('audit_logs')
        .select('id, action, created_at, admin_id, details, admin_users (display_name, email)')
        .eq('entity_type', 'support_tickets')
        .eq('entity_id', ticketId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching ticket history:', error?.message || error);
        return [];
    }

    const rows = (data || []) as Array<{
        id: string;
        action: string;
        created_at: string;
        admin_id: string | null;
        details: Record<string, unknown> | null;
        admin_users?: { display_name?: string | null; email?: string | null } | { display_name?: string | null; email?: string | null }[] | null;
    }>;

    return rows.map((row) => {
        const admin = Array.isArray(row.admin_users) ? row.admin_users[0] : row.admin_users;
        return {
            id: row.id,
            action: row.action,
            created_at: row.created_at,
            admin_id: row.admin_id,
            admin_name: admin?.display_name || admin?.email || null,
            details: (row.details as Record<string, unknown> | null) || null,
        };
    });
}

export async function getAdminAssignees(): Promise<{ assignees: AdminAssignee[]; canAssign: boolean }> {
    const canAssign = await hasPermission('tickets:assign');
    if (!canAssign) {
        return { assignees: [], canAssign: false };
    }
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('admin_users')
        .select('id, email, display_name, role, is_active')
        .eq('is_active', true)
        .in('role', ASSIGNABLE_ROLES)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching admin assignees:', error?.message || error);
        return { assignees: [], canAssign };
    }

    return { assignees: (data || []) as AdminAssignee[], canAssign };
}

export async function assignAdminTicket(ticketId: string, adminId: string | null): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await requirePermission('tickets:assign');
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    if (adminId && !isUuid(adminId)) {
        return { success: false, error: 'Admin inválido.' };
    }

    const { data: ticket } = await adminClient
        .from('support_tickets')
        .select('id, subject')
        .eq('id', ticketId)
        .maybeSingle();

    const { error } = await adminClient
        .from('support_tickets')
        .update({ assigned_admin_id: adminId })
        .eq('id', ticketId);

    if (error) {
        console.error('Error assigning ticket:', error?.message || error);
        return { success: false, error: 'No se pudo asignar el ticket.' };
    }

    await logAdminAction(session.adminId, 'ASSIGN_TICKET', 'support_tickets', ticketId, {
        assigned_admin_id: adminId,
    });

    if (adminId) {
        try {
            const summary = ticket?.subject ? `Ticket asignado: ${ticket.subject}` : 'Se te asigno un ticket nuevo.';
            await createNotification(adminId, 'SYSTEM_ALERT', 'Nuevo ticket asignado', summary, {
                ticket_id: ticketId,
            });
        } catch (notificationError) {
            console.error('Error creating assignment notification:', notificationError);
        }
    }

    return { success: true };
}

export async function updateAdminTicketStatus(ticketId: string, status: TicketStatus): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    const resolvedAt = status === 'RESOLVED' || status === 'CLOSED'
        ? new Date().toISOString()
        : null;

    const { error } = await adminClient
        .from('support_tickets')
        .update({ status, resolved_at: resolvedAt })
        .eq('id', ticketId);

    if (error) {
        console.error('Error updating ticket status:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar el estado.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_TICKET_STATUS', 'support_tickets', ticketId, {
        status,
    });

    return { success: true };
}

export async function updateAdminTicketPriority(ticketId: string, priority: TicketPriority): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    const { error } = await adminClient
        .from('support_tickets')
        .update({ priority })
        .eq('id', ticketId);

    if (error) {
        console.error('Error updating ticket priority:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar la prioridad.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_TICKET_PRIORITY', 'support_tickets', ticketId, {
        priority,
    });

    return { success: true };
}

export async function addAdminTicketMessage(
    ticketId: string,
    message: string,
    isInternal: boolean
): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('tickets:update');
    const adminClient = createAdminClient();
    const trimmed = message.trim();

    if (!trimmed) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    const { data: ticket } = await adminClient
        .from('support_tickets')
        .select('id, status, user_id, subject, tenant_id')
        .eq('id', ticketId)
        .maybeSingle();

    if (!ticket) {
        return { success: false, error: 'Ticket no encontrado.' };
    }

    if (ticket.status === 'CLOSED') {
        return { success: false, error: 'Este ticket está cerrado. Reábrelo para responder.' };
    }

    const { error } = await adminClient
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            sender_type: 'ADMIN',
            sender_id: session.adminId,
            message: trimmed,
            is_internal: isInternal,
        });

    if (error) {
        console.error('Error adding admin message:', error?.message || error);
        return { success: false, error: 'No se pudo enviar el mensaje.' };
    }

    if (!isInternal) {
        await adminClient
            .from('support_tickets')
            .update({ status: 'WAITING_USER', resolved_at: null })
            .eq('id', ticketId);
    }

    if (!isInternal && ticket?.user_id && ticket?.tenant_id) {
        try {
            const summary = ticket.subject ? `Respondimos tu ticket: ${ticket.subject}` : 'Respondimos tu ticket de soporte.';
            await adminClient
                .from('user_notifications')
                .insert({
                    tenant_id: ticket.tenant_id,
                    user_id: ticket.user_id,
                    type: 'SYSTEM',
                    severity: 'INFO',
                    title: 'Respuesta del equipo RutaCero',
                    message: summary,
                    metadata: { ticket_id: ticketId },
                });
        } catch (notificationError) {
            console.error('Error notifying user about ticket reply:', notificationError);
        }
    }

    await logAdminAction(session.adminId, isInternal ? 'ADD_INTERNAL_NOTE' : 'REPLY_TICKET', 'support_tickets', ticketId, {
        internal: isInternal,
    });

    return { success: true };
}
