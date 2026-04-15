import type { Database } from '@/types/supabase';

export type TicketPriority = Database['public']['Enums']['ticket_priority'];
export type TicketStatus = Database['public']['Enums']['ticket_status'];

export type SlaState = {
    status: 'OK' | 'AT_RISK' | 'OVERDUE' | 'PAUSED';
    targetHours: number;
    elapsedHours: number;
    remainingHours: number;
    dueAt: string | null;
};

export const SLA_TARGET_HOURS: Record<TicketPriority, number> = {
    URGENT: 4,
    HIGH: 12,
    MEDIUM: 24,
    LOW: 48,
};

const PAUSED_STATUSES: TicketStatus[] = ['CLOSED', 'RESOLVED', 'WAITING_USER'];

export function getSlaState(input: {
    priority: TicketPriority;
    status: TicketStatus;
    lastUserAt: string | null;
    lastAdminAt: string | null;
    now?: number;
}): SlaState {
    const targetHours = SLA_TARGET_HOURS[input.priority] ?? 48;
    const now = input.now ?? Date.now();

    if (PAUSED_STATUSES.includes(input.status)) {
        return {
            status: 'PAUSED',
            targetHours,
            elapsedHours: 0,
            remainingHours: targetHours,
            dueAt: null,
        };
    }

    if (!input.lastUserAt) {
        return {
            status: 'PAUSED',
            targetHours,
            elapsedHours: 0,
            remainingHours: targetHours,
            dueAt: null,
        };
    }

    if (input.lastAdminAt && new Date(input.lastAdminAt).getTime() > new Date(input.lastUserAt).getTime()) {
        return {
            status: 'PAUSED',
            targetHours,
            elapsedHours: 0,
            remainingHours: targetHours,
            dueAt: null,
        };
    }

    const lastUserAt = new Date(input.lastUserAt).getTime();
    const elapsedHours = Math.max(0, (now - lastUserAt) / 36e5);
    const remainingHours = targetHours - elapsedHours;
    const dueAt = new Date(lastUserAt + targetHours * 36e5).toISOString();

    if (elapsedHours >= targetHours) {
        return {
            status: 'OVERDUE',
            targetHours,
            elapsedHours,
            remainingHours,
            dueAt,
        };
    }

    if (elapsedHours >= targetHours * 0.75) {
        return {
            status: 'AT_RISK',
            targetHours,
            elapsedHours,
            remainingHours,
            dueAt,
        };
    }

    return {
        status: 'OK',
        targetHours,
        elapsedHours,
        remainingHours,
        dueAt,
    };
}
