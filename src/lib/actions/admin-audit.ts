'use server';

import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { requirePermission } from '@/lib/actions/admin-auth';
import { logger } from '@/lib/logger';

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

// Audit logs are read via Drizzle (Supabase client removed in F6). Both
// reads and writes must tolerate a missing/not-yet-migrated table so the
// audit page never 500s - see logAdminAction() in admin-auth.ts.
export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
    await requirePermission('audit:read');

    try {
        const db = getDb();
        const conditions: SQL[] = [];

        if (filters?.action && filters.action !== 'ALL') {
            conditions.push(eq(schema.auditLogs.action, filters.action));
        }
        if (filters?.adminId && filters.adminId !== 'ALL') {
            conditions.push(eq(schema.auditLogs.adminUserId, filters.adminId));
        }
        if (filters?.entityType && filters.entityType !== 'ALL') {
            conditions.push(eq(schema.auditLogs.entityType, filters.entityType));
        }
        if (filters?.from) {
            conditions.push(gte(schema.auditLogs.createdAt, new Date(filters.from)));
        }
        if (filters?.to) {
            conditions.push(lte(schema.auditLogs.createdAt, new Date(filters.to)));
        }
        if (filters?.entityId) {
            conditions.push(eq(schema.auditLogs.entityId, filters.entityId));
        }

        const rows = await db
            .select({
                id: schema.auditLogs.id,
                adminId: schema.auditLogs.adminId,
                adminUserId: schema.auditLogs.adminUserId,
                action: schema.auditLogs.action,
                entityType: schema.auditLogs.entityType,
                entityId: schema.auditLogs.entityId,
                details: schema.auditLogs.details,
                metadata: schema.auditLogs.metadata,
                createdAt: schema.auditLogs.createdAt,
                adminEmail: schema.adminUsers.email,
                adminDisplayName: schema.adminUsers.displayName,
            })
            .from(schema.auditLogs)
            .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.auditLogs.adminUserId))
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(schema.auditLogs.createdAt))
            .limit(Math.max(1, Math.min(filters?.limit ?? 200, 500)));

        return rows.map((row) => ({
            id: row.id,
            admin_id: row.adminId || row.adminUserId,
            admin_name: row.adminDisplayName || row.adminEmail || null,
            action: row.action,
            entity_type: row.entityType,
            entity_id: row.entityId,
            details: (row.details as Record<string, unknown> | null) ?? (row.metadata as Record<string, unknown> | null) ?? null,
            created_at: row.createdAt.toISOString(),
        }));
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching audit logs');
        return [];
    }
}

export async function getAuditActors(): Promise<Array<{ id: string; label: string }>> {
    await requirePermission('audit:read');

    try {
        const db = getDb();
        const rows = await db
            .select({
                id: schema.adminUsers.id,
                email: schema.adminUsers.email,
                displayName: schema.adminUsers.displayName,
            })
            .from(schema.adminUsers)
            .where(eq(schema.adminUsers.isActive, true))
            .orderBy(schema.adminUsers.createdAt);

        return rows.map((admin) => ({
            id: admin.id,
            label: admin.displayName || admin.email,
        }));
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching audit actors');
        return [];
    }
}
