'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { autoAssignTicketIfEnabled } from '@/lib/support/assignment';
import { createNotification, notifyAllAdmins } from '@/lib/actions/admin-notifications';
import type { Database } from '@/types/supabase';
import { requireUserTenant } from '@/lib/tenant/server';

export type TicketStatus = Database['public']['Enums']['ticket_status'];
export type TicketPriority = Database['public']['Enums']['ticket_priority'];
export type TicketCategory = Database['public']['Enums']['ticket_category'];

export interface SupportTicket {
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

interface SupportRuleMatch {
    priority?: TicketPriority;
    assignedAdminId?: string | null;
}

const applySupportAutomationRules = async (params: {
    ticketId: string;
    category: TicketCategory;
    userId: string;
    tenantId: string;
    currentPriority: TicketPriority;
}): Promise<SupportRuleMatch> => {
    const adminClient = createAdminClient();

    const { data: subscription } = await adminClient
        .from('subscriptions')
        .select('plan_code, status')
        .eq('tenant_id', params.tenantId)
        .eq('status', 'ACTIVE')
        .single();

    const planCode = subscription?.plan_code || 'FREE';

    const { data: rules, error } = await adminClient
        .from('admin_support_rules')
        .select('id, category, plan_code, set_priority, assign_role, is_active')
        .eq('is_active', true)
        .eq('category', params.category)
        .order('created_at', { ascending: true });

    if (error || !rules?.length) {
        if (error) {
            console.error('Error fetching support rules:', error?.message || error);
        }
        return {};
    }

    const matchingRule = rules.find((rule) => rule.plan_code === planCode) || rules.find((rule) => !rule.plan_code);
    if (!matchingRule) {
        return {};
    }

    let updatedPriority: TicketPriority | undefined;
    if (matchingRule.set_priority && matchingRule.set_priority !== params.currentPriority) {
        const { error: priorityError } = await adminClient
            .from('support_tickets')
            .update({ priority: matchingRule.set_priority as TicketPriority })
            .eq('id', params.ticketId);

        if (priorityError) {
            console.error('Error applying rule priority:', priorityError?.message || priorityError);
        } else {
            updatedPriority = matchingRule.set_priority as TicketPriority;
        }
    }

    let assignedAdminId: string | null = null;
    if (matchingRule.assign_role) {
        const { data: admins, error: adminError } = await adminClient
            .from('admin_users')
            .select('id')
            .eq('is_active', true)
            .eq('role', matchingRule.assign_role as Database['public']['Enums']['admin_role']);

        if (adminError) {
            console.error('Error fetching admins for rule:', adminError?.message || adminError);
        } else if (admins?.length) {
            const adminIds = admins.map((admin) => admin.id);
            const { data: assigned, error: assignedError } = await adminClient
                .from('support_tickets')
                .select('assigned_admin_id, status')
                .in('assigned_admin_id', adminIds)
                .in('status', ['OPEN', 'IN_PROGRESS']);

            if (assignedError) {
                console.error('Error fetching assignments for rule:', assignedError?.message || assignedError);
            }

            const counts = new Map<string, number>();
            adminIds.forEach((id) => counts.set(id, 0));
            (assigned || []).forEach((ticket) => {
                if (!ticket.assigned_admin_id) return;
                counts.set(ticket.assigned_admin_id, (counts.get(ticket.assigned_admin_id) || 0) + 1);
            });

            const [selected] = Array.from(counts.entries()).sort((a, b) => a[1] - b[1]);
            assignedAdminId = selected?.[0] || null;

            if (assignedAdminId) {
                const { error: assignError } = await adminClient
                    .from('support_tickets')
                    .update({ assigned_admin_id: assignedAdminId })
                    .eq('id', params.ticketId);

                if (assignError) {
                    console.error('Error applying rule assignment:', assignError?.message || assignError);
                    assignedAdminId = null;
                }
            }
        }
    }

    return { priority: updatedPriority, assignedAdminId };
};

interface TicketCreateInput {
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function getUserTickets(): Promise<SupportTicket[]> {
    const { user, tenantId } = await requireUserTenant();
    const adminClient = createAdminClient();
    const initialResult = await adminClient
        .from('support_tickets')
        .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_admin_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    let data = initialResult.data;
    const error = initialResult.error;

    if (error) {
        console.error('Error fetching user tickets:', error?.message || error);
        const fallback = await adminClient
            .from('support_tickets')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
        if (fallback.error) {
            console.error('Fallback ticket query failed:', fallback.error?.message || fallback.error);
            return [];
        }
        data = fallback.data as SupportTicket[];
    }

    return (data || []) as SupportTicket[];
}

export async function getUserTicketWithMessages(ticketId: string): Promise<{
    ticket: SupportTicket;
    messages: TicketMessage[];
} | null> {
    const { user, tenantId } = await requireUserTenant();
    const adminClient = createAdminClient();
    if (!ticketId || !isUuid(ticketId)) {
        console.error('Error fetching ticket: invalid ticket id');
        return null;
    }
    const ticketResult = await adminClient
        .from('support_tickets')
        .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_admin_id')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    let ticket = ticketResult.data as SupportTicket | null;
    const ticketError = ticketResult.error;

    if (ticketError) {
        console.error('Error fetching ticket:', ticketError?.message || ticketError);
        const fallback = await adminClient
            .from('support_tickets')
            .select('*')
            .eq('id', ticketId)
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (fallback.error) {
            console.error('Fallback ticket query failed:', fallback.error?.message || fallback.error);
            return null;
        }
        ticket = fallback.data as SupportTicket | null;
    }

    if (!ticket) {
        return null;
    }

    const messagesResult = await adminClient
        .from('ticket_messages')
        .select('id, ticket_id, sender_type, sender_id, message, is_internal, created_at')
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

    let messages = messagesResult.data as TicketMessage[] | null;
    const messageError = messagesResult.error;

    if (messageError) {
        console.error('Error fetching messages:', messageError?.message || messageError);
        const fallback = await adminClient
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .eq('tenant_id', tenantId)
            .eq('is_internal', false)
            .order('created_at', { ascending: true });
        if (fallback.error) {
            console.error('Fallback message query failed:', fallback.error?.message || fallback.error);
            return { ticket: ticket as SupportTicket, messages: [] };
        }
        messages = fallback.data as TicketMessage[];
    }

    return {
        ticket: ticket as SupportTicket,
        messages: (messages || []) as TicketMessage[],
    };
}

export async function createSupportTicket(input: TicketCreateInput): Promise<{
    success: boolean;
    error?: string;
    ticket?: SupportTicket;
}> {
    const { supabase, user, tenantId } = await requireUserTenant();
    const subject = input.subject.trim();
    const description = input.description.trim();

    if (!subject || !description) {
        return { success: false, error: 'Completa el asunto y la descripción.' };
    }

    const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            subject,
            description,
            body: description,
            category: input.category,
            priority: input.priority,
        })
        .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_admin_id')
        .single();

    if (error) {
        console.error('Error creating ticket:', error);
        return { success: false, error: 'No se pudo crear el ticket.' };
    }

    if (!ticket?.id) {
        return { success: false, error: 'No se pudo obtener el ID del ticket.' };
    }

    const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert({
            tenant_id: tenantId,
            ticket_id: ticket.id,
            sender_type: 'USER',
            sender_id: user.id,
            message: description,
            is_internal: false,
        });

    if (messageError) {
        console.error('Error creating ticket message:', messageError);
    }

    let assignedAdminId: string | null = null;
    let updatedPriority: TicketPriority = ticket.priority as TicketPriority;
    try {
        const ruleResult = await applySupportAutomationRules({
            ticketId: ticket.id,
            category: ticket.category as TicketCategory,
            userId: user.id,
            tenantId,
            currentPriority: ticket.priority as TicketPriority,
        });
        if (ruleResult.priority) {
            updatedPriority = ruleResult.priority;
        }
        if (ruleResult.assignedAdminId) {
            assignedAdminId = ruleResult.assignedAdminId;
            await createNotification(
                assignedAdminId,
                'SYSTEM_ALERT',
                'Ticket asignado por regla',
                `${subject} · ${ticket.category}`,
                { ticket_id: ticket.id, user_id: user.id }
            );
        }
    } catch (ruleError) {
        console.error('Error applying support automation rules:', ruleError);
    }

    if (!assignedAdminId) {
        try {
            const assignment = await autoAssignTicketIfEnabled(ticket.id, updatedPriority);
            assignedAdminId = assignment.assignments?.[0]?.adminId ?? null;
        } catch (autoAssignError) {
            console.error('Error auto-assigning ticket:', autoAssignError);
        }
    }

    try {
        const message = `${subject} · Prioridad ${updatedPriority.toLowerCase()}`;
        if (assignedAdminId) {
            await createNotification(
                assignedAdminId,
                'SYSTEM_ALERT',
                'Ticket asignado',
                message,
                { ticket_id: ticket.id, user_id: user.id }
            );
        } else {
            await notifyAllAdmins(
                'SYSTEM_ALERT',
                'Nuevo ticket de soporte',
                message,
                { ticket_id: ticket.id, user_id: user.id }
            );
        }
    } catch (notificationError) {
        console.error('Error notifying admins about ticket:', notificationError);
    }

    revalidatePath('/help');
    revalidatePath(`/help/${ticket.id}`);

    return { success: true, ticket: ticket as SupportTicket };
}

export async function addTicketMessage(ticketId: string, message: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const { supabase, user, tenantId } = await requireUserTenant();
    const trimmed = message.trim();

    if (!trimmed) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    const { data: ticket } = await supabase
        .from('support_tickets')
        .select('id, status, assigned_admin_id, subject, tenant_id')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!ticket) {
        return { success: false, error: 'Ticket no encontrado.' };
    }

    if (ticket.status === 'CLOSED') {
        return { success: false, error: 'Este ticket está cerrado. Reábrelo para enviar mensajes.' };
    }

    if (ticket.status === 'RESOLVED' || ticket.status === 'WAITING_USER') {
        const adminClient = createAdminClient();
        const { error: statusError } = await adminClient
            .from('support_tickets')
            .update({ status: 'OPEN', resolved_at: null })
            .eq('id', ticketId);

        if (statusError) {
            console.error('Error updating ticket status on user reply:', statusError?.message || statusError);
        }
    }

    const { error } = await supabase
        .from('ticket_messages')
        .insert({
            tenant_id: ticket.tenant_id,
            ticket_id: ticketId,
            sender_type: 'USER',
            sender_id: user.id,
            message: trimmed,
            is_internal: false,
        });

    if (error) {
        console.error('Error sending ticket message:', error);
        return { success: false, error: 'No se pudo enviar el mensaje.' };
    }

    try {
        const messageSummary = ticket?.subject || 'Nuevo mensaje en ticket';
        if (ticket?.assigned_admin_id) {
            await createNotification(
                ticket.assigned_admin_id,
                'SYSTEM_ALERT',
                'Nueva respuesta del usuario',
                messageSummary,
                { ticket_id: ticketId, user_id: user.id }
            );
        } else {
            await notifyAllAdmins(
                'SYSTEM_ALERT',
                'Nueva respuesta del usuario',
                messageSummary,
                { ticket_id: ticketId, user_id: user.id }
            );
        }
    } catch (notificationError) {
        console.error('Error notifying admins about ticket reply:', notificationError);
    }

    revalidatePath(`/help/${ticketId}`);
    revalidatePath('/help');

    return { success: true };
}

export async function setUserTicketStatus(ticketId: string, status: 'CLOSED' | 'OPEN'): Promise<{
    success: boolean;
    error?: string;
}> {
    const { supabase, user, tenantId } = await requireUserTenant();
    const adminClient = createAdminClient();

    if (!ticketId || !isUuid(ticketId)) {
        return { success: false, error: 'Ticket inválido.' };
    }

    const { data: ticket } = await adminClient
        .from('support_tickets')
        .select('id, user_id, status, tenant_id')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

    if (!ticket || ticket.user_id !== user.id) {
        return { success: false, error: 'Ticket no encontrado.' };
    }

    if (status === 'CLOSED' && ticket.status === 'CLOSED') {
        return { success: true };
    }

    if (status === 'OPEN' && ticket.status !== 'CLOSED') {
        return { success: true };
    }

    const resolvedAt = status === 'CLOSED' ? new Date().toISOString() : null;
    const { error } = await adminClient
        .from('support_tickets')
        .update({ status, resolved_at: resolvedAt })
        .eq('id', ticketId);

    if (error) {
        console.error('Error updating ticket status:', error);
        return { success: false, error: 'No se pudo actualizar el estado.' };
    }

    const systemMessage = status === 'CLOSED'
        ? 'El usuario cerró el ticket.'
        : 'El usuario reabrió el ticket.';

    await supabase
        .from('ticket_messages')
        .insert({
            tenant_id: ticket.tenant_id,
            ticket_id: ticketId,
            sender_type: 'USER',
            sender_id: user.id,
            message: systemMessage,
            is_internal: false,
        });

    revalidatePath(`/help/${ticketId}`);
    revalidatePath('/help');

    return { success: true };
}
