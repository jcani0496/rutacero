'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/actions/admin-auth';

export interface AuditLogEntry {
    id: string;
    admin_id: string;
    admin_name: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
}

interface AuditLogFilters {
    action?: string;
    adminId?: string;
    entityType?: string;
    from?: string;
    to?: string;
    entityId?: string;
    limit?: number;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
    await requirePermission('audit:read');
    const adminClient = createAdminClient();

    let query = adminClient
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, details, created_at, admin_id, admin_users (display_name, email)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 200);

    if (filters?.action && filters.action !== 'ALL') {
        query = query.eq('action', filters.action);
    }
    if (filters?.adminId && filters.adminId !== 'ALL') {
        query = query.eq('admin_id', filters.adminId);
    }
    if (filters?.entityType && filters.entityType !== 'ALL') {
        query = query.eq('entity_type', filters.entityType);
    }
    if (filters?.from) {
        query = query.gte('created_at', filters.from);
    }
    if (filters?.to) {
        query = query.lte('created_at', filters.to);
    }
    if (filters?.entityId && isUuid(filters.entityId)) {
        query = query.eq('entity_id', filters.entityId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching audit logs:', error?.message || error);
        return [];
    }

    const rows = (data || []) as Array<{
        id: string;
        admin_id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        details: Record<string, unknown> | null;
        created_at: string;
        admin_users?: { display_name?: string | null; email?: string | null } | { display_name?: string | null; email?: string | null }[] | null;
    }>;

    return rows.map((row) => {
        const admin = Array.isArray(row.admin_users) ? row.admin_users[0] : row.admin_users;
        return {
            id: row.id,
            admin_id: row.admin_id,
            admin_name: admin?.display_name || admin?.email || null,
            action: row.action,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            details: row.details || null,
            created_at: row.created_at,
        };
    });
}

export async function getAuditActors(): Promise<Array<{ id: string; label: string }>> {
    await requirePermission('audit:read');
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from('admin_users')
        .select('id, email, display_name')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching audit actors:', error?.message || error);
        return [];
    }

    return (data || []).map((admin) => ({
        id: admin.id,
        label: admin.display_name || admin.email,
    }));
}
