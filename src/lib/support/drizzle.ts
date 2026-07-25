/**
 * Drizzle data-access helpers for the admin/support domain (F3f).
 * Callers branch with isDrizzleEnabled() and keep the PostgREST path as default.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import { getDb, type Db } from "@/db/client";
import {
  adminNotifications,
  adminReplyTemplates,
  adminSavedViews,
  adminSupportRules,
  adminSupportSettings,
  adminUsers,
  alerts,
  auditLogs,
  subscriptions,
  supportTicketLabels,
  supportTickets,
  ticketMessages,
  userNotifications,
} from "@/db/schema";
import {
  mapAdminReplyTemplateRow,
  mapAdminSavedViewRow,
  mapAdminSupportRuleRow,
  mapAdminSupportSettingsRow,
  mapAdminUserRow,
  mapAlertRow,
  mapSupportTicketLabelRow,
  mapSupportTicketRow,
  mapTicketMessageRow,
  type AdminReplyTemplateMapped,
  type AdminSavedViewMapped,
  type AdminSupportRuleMapped,
  type AdminSupportSettingsMapped,
  type AdminUserMapped,
  type AlertMapped,
  type SupportTicketLabelMapped,
  type SupportTicketMapped,
  type TicketMessageMapped,
} from "@/lib/data/mappers";

const ASSIGNABLE_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT"] as const;
const ACTIVE_TICKET_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

function db(): Db {
  return getDb();
}

// ---------------------------------------------------------------------------
// Settings / assignment
// ---------------------------------------------------------------------------

export async function drizzleGetSupportSettings(): Promise<AdminSupportSettingsMapped | null> {
  const rows = await db()
    .select()
    .from(adminSupportSettings)
    .orderBy(desc(adminSupportSettings.updatedAt))
    .limit(1);
  return rows[0] ? mapAdminSupportSettingsRow(rows[0]) : null;
}

export async function drizzleInsertSupportSettings(values: {
  autoAssignEnabled: boolean;
  autoAssignStrategy: string;
  autoAssignPriorities: string[];
  lastRoundRobinIndex: number;
  slaEscalationEnabled: boolean;
  staleReassignEnabled: boolean;
  staleReassignHours: number;
}): Promise<AdminSupportSettingsMapped | null> {
  const [row] = await db()
    .insert(adminSupportSettings)
    .values({
      autoAssignEnabled: values.autoAssignEnabled,
      autoAssignStrategy: values.autoAssignStrategy,
      autoAssignPriorities: values.autoAssignPriorities,
      lastRoundRobinIndex: values.lastRoundRobinIndex,
      slaEscalationEnabled: values.slaEscalationEnabled,
      staleReassignEnabled: values.staleReassignEnabled,
      staleReassignHours: values.staleReassignHours,
    })
    .returning();
  return row ? mapAdminSupportSettingsRow(row) : null;
}

export async function drizzleUpdateSupportSettings(
  id: string,
  updates: Partial<{
    autoAssignEnabled: boolean;
    autoAssignStrategy: string;
    autoAssignPriorities: string[];
    lastRoundRobinIndex: number;
    slaEscalationEnabled: boolean;
    staleReassignEnabled: boolean;
    staleReassignHours: number;
  }>,
): Promise<AdminSupportSettingsMapped | null> {
  const [row] = await db()
    .update(adminSupportSettings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(adminSupportSettings.id, id))
    .returning();
  return row ? mapAdminSupportSettingsRow(row) : null;
}

export async function drizzleGetAssignableAdmins(): Promise<AdminUserMapped[]> {
  const rows = await db()
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })
    .from(adminUsers)
    .where(
      and(
        eq(adminUsers.isActive, true),
        inArray(adminUsers.role, [...ASSIGNABLE_ROLES]),
      ),
    );
  return rows.map(mapAdminUserRow);
}

export async function drizzleGetUnassignedTickets(input: {
  priorities: string[];
  ticketIds?: string[];
}): Promise<
  Array<{ id: string; priority: string; status: string; created_at: string }>
> {
  const conditions = [
    isNull(supportTickets.assignedAdminId),
    inArray(supportTickets.status, [...ACTIVE_TICKET_STATUSES]),
  ];
  if (input.ticketIds?.length) {
    conditions.push(inArray(supportTickets.id, input.ticketIds));
  }
  if (input.priorities.length) {
    conditions.push(inArray(supportTickets.priority, input.priorities));
  }
  const rows = await db()
    .select({
      id: supportTickets.id,
      priority: supportTickets.priority,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(and(...conditions));
  return rows.map((row) => ({
    id: row.id,
    priority: row.priority,
    status: row.status,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }));
}

export async function drizzleGetActiveAssignments(
  adminIds: string[],
): Promise<Array<{ id: string; assigned_admin_id: string | null }>> {
  if (!adminIds.length) return [];
  const rows = await db()
    .select({
      id: supportTickets.id,
      assignedAdminId: supportTickets.assignedAdminId,
    })
    .from(supportTickets)
    .where(
      and(
        inArray(supportTickets.assignedAdminId, adminIds),
        inArray(supportTickets.status, [...ACTIVE_TICKET_STATUSES]),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    assigned_admin_id: row.assignedAdminId,
  }));
}

export async function drizzleAssignTicket(
  ticketId: string,
  adminId: string | null,
): Promise<void> {
  await db()
    .update(supportTickets)
    .set({ assignedAdminId: adminId, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));
}

// ---------------------------------------------------------------------------
// User-facing tickets
// ---------------------------------------------------------------------------

export async function drizzleGetUserTickets(
  tenantId: string,
  userId: string,
): Promise<SupportTicketMapped[]> {
  const rows = await db()
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.tenantId, tenantId),
        eq(supportTickets.userId, userId),
      ),
    )
    .orderBy(desc(supportTickets.updatedAt));
  return rows.map(mapSupportTicketRow);
}

export async function drizzleGetUserTicket(
  ticketId: string,
  tenantId: string,
  userId: string,
): Promise<SupportTicketMapped | null> {
  const rows = await db()
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, ticketId),
        eq(supportTickets.tenantId, tenantId),
        eq(supportTickets.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ? mapSupportTicketRow(rows[0]) : null;
}

export async function drizzleGetTicketMessages(
  ticketId: string,
  options?: { tenantId?: string; publicOnly?: boolean },
): Promise<TicketMessageMapped[]> {
  const conditions = [eq(ticketMessages.ticketId, ticketId)];
  if (options?.tenantId) {
    conditions.push(eq(ticketMessages.tenantId, options.tenantId));
  }
  if (options?.publicOnly) {
    conditions.push(eq(ticketMessages.isInternal, false));
  }
  const rows = await db()
    .select()
    .from(ticketMessages)
    .where(and(...conditions))
    .orderBy(asc(ticketMessages.createdAt));
  return rows.map(mapTicketMessageRow);
}

export async function drizzleCreateTicket(input: {
  tenantId: string;
  userId: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
}): Promise<SupportTicketMapped | null> {
  const [row] = await db()
    .insert(supportTickets)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      subject: input.subject,
      description: input.description,
      body: input.description,
      category: input.category,
      priority: input.priority,
    })
    .returning();
  return row ? mapSupportTicketRow(row) : null;
}

export async function drizzleInsertTicketMessage(input: {
  tenantId?: string | null;
  ticketId: string;
  senderType: string;
  senderId: string;
  message: string;
  isInternal?: boolean;
}): Promise<void> {
  await db().insert(ticketMessages).values({
    tenantId: input.tenantId ?? null,
    ticketId: input.ticketId,
    senderType: input.senderType,
    senderId: input.senderId,
    message: input.message,
    isInternal: input.isInternal ?? false,
  });
}

export async function drizzleUpdateTicket(
  ticketId: string,
  updates: Partial<{
    status: string;
    priority: string;
    assignedAdminId: string | null;
    resolvedAt: Date | null;
  }>,
): Promise<void> {
  await db()
    .update(supportTickets)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));
}

export async function drizzleGetActiveSubscriptionPlan(
  tenantId: string,
): Promise<string> {
  const rows = await db()
    .select({ planCode: subscriptions.planCode })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return rows[0]?.planCode || "FREE";
}

export async function drizzleGetActiveRulesForCategory(
  category: string,
): Promise<AdminSupportRuleMapped[]> {
  const rows = await db()
    .select()
    .from(adminSupportRules)
    .where(
      and(
        eq(adminSupportRules.isActive, true),
        eq(adminSupportRules.category, category as never),
      ),
    )
    .orderBy(asc(adminSupportRules.createdAt));
  return rows.map(mapAdminSupportRuleRow);
}

export async function drizzleGetAdminsByRole(
  role: string,
): Promise<Array<{ id: string }>> {
  const rows = await db()
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.isActive, true), eq(adminUsers.role, role)));
  return rows;
}

// ---------------------------------------------------------------------------
// Admin tickets / metrics helpers
// ---------------------------------------------------------------------------

export async function drizzleListTickets(
  options?: { statuses?: string[]; assignedAdminIds?: string[] },
): Promise<SupportTicketMapped[]> {
  const conditions: import("drizzle-orm").SQL[] = [];
  if (options?.statuses?.length) {
    conditions.push(inArray(supportTickets.status, options.statuses));
  }
  if (options?.assignedAdminIds?.length) {
    conditions.push(
      inArray(supportTickets.assignedAdminId, options.assignedAdminIds),
    );
  }
  const query = db().select().from(supportTickets);
  const rows = conditions.length
    ? await query
        .where(and(...conditions))
        .orderBy(desc(supportTickets.updatedAt))
    : await query.orderBy(desc(supportTickets.updatedAt));
  return rows.map(mapSupportTicketRow);
}

export async function drizzleGetTicketById(
  ticketId: string,
): Promise<SupportTicketMapped | null> {
  const rows = await db()
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  return rows[0] ? mapSupportTicketRow(rows[0]) : null;
}

export async function drizzleGetMessageStatsRows(
  ticketIds: string[],
): Promise<
  Array<{
    ticket_id: string;
    sender_type: string;
    is_internal: boolean;
    created_at: string;
  }>
> {
  if (!ticketIds.length) return [];
  const rows = await db()
    .select({
      ticketId: ticketMessages.ticketId,
      senderType: ticketMessages.senderType,
      isInternal: ticketMessages.isInternal,
      createdAt: ticketMessages.createdAt,
    })
    .from(ticketMessages)
    .where(inArray(ticketMessages.ticketId, ticketIds));
  return rows.map((row) => ({
    ticket_id: row.ticketId,
    sender_type: row.senderType,
    is_internal: Boolean(row.isInternal),
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }));
}

export async function drizzleBulkUpdateTickets(
  ticketIds: string[],
  updates: Partial<{
    status: string;
    priority: string;
    assignedAdminId: string | null;
    resolvedAt: Date | null;
  }>,
): Promise<number> {
  if (!ticketIds.length) return 0;
  const rows = await db()
    .update(supportTickets)
    .set({ ...updates, updatedAt: new Date() })
    .where(inArray(supportTickets.id, ticketIds))
    .returning({ id: supportTickets.id });
  return rows.length;
}

export async function drizzleListRules(): Promise<AdminSupportRuleMapped[]> {
  const rows = await db()
    .select()
    .from(adminSupportRules)
    .orderBy(desc(adminSupportRules.createdAt));
  return rows.map(mapAdminSupportRuleRow);
}

export async function drizzleInsertRule(input: {
  name: string;
  category: string;
  planCode: string | null;
  setPriority: string | null;
  assignRole: string | null;
}): Promise<AdminSupportRuleMapped | null> {
  const [row] = await db()
    .insert(adminSupportRules)
    .values({
      name: input.name,
      category: input.category as never,
      planCode: input.planCode,
      setPriority: (input.setPriority as never) ?? null,
      assignRole: (input.assignRole as never) ?? null,
    })
    .returning();
  return row ? mapAdminSupportRuleRow(row) : null;
}

export async function drizzleUpdateRuleActive(
  ruleId: string,
  isActive: boolean,
): Promise<void> {
  await db()
    .update(adminSupportRules)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(adminSupportRules.id, ruleId));
}

export async function drizzleDeleteRule(ruleId: string): Promise<void> {
  await db().delete(adminSupportRules).where(eq(adminSupportRules.id, ruleId));
}

export async function drizzleListSavedViews(
  adminId: string,
): Promise<AdminSavedViewMapped[]> {
  const rows = await db()
    .select()
    .from(adminSavedViews)
    .where(eq(adminSavedViews.adminId, adminId))
    .orderBy(desc(adminSavedViews.createdAt));
  return rows.map(mapAdminSavedViewRow);
}

export async function drizzleInsertSavedView(input: {
  adminId: string;
  name: string;
  filters: Record<string, unknown>;
}): Promise<AdminSavedViewMapped | null> {
  const [row] = await db()
    .insert(adminSavedViews)
    .values({
      adminId: input.adminId,
      name: input.name,
      filters: input.filters,
    })
    .returning();
  return row ? mapAdminSavedViewRow(row) : null;
}

export async function drizzleDeleteSavedView(
  viewId: string,
  adminId: string,
): Promise<void> {
  await db()
    .delete(adminSavedViews)
    .where(
      and(
        eq(adminSavedViews.id, viewId),
        eq(adminSavedViews.adminId, adminId),
      ),
    );
}

export async function drizzleListReplyTemplates(
  includeInactive: boolean,
): Promise<AdminReplyTemplateMapped[]> {
  const query = db()
    .select()
    .from(adminReplyTemplates)
    .orderBy(desc(adminReplyTemplates.createdAt));
  const rows = includeInactive
    ? await query
    : await query.where(eq(adminReplyTemplates.isActive, true));
  return rows.map(mapAdminReplyTemplateRow);
}

export async function drizzleInsertReplyTemplate(input: {
  title: string;
  body: string;
  isActive: boolean;
  createdBy: string;
}): Promise<void> {
  await db().insert(adminReplyTemplates).values({
    title: input.title,
    body: input.body,
    isActive: input.isActive,
    createdBy: input.createdBy,
  });
}

export async function drizzleUpdateReplyTemplate(
  id: string,
  updates: Partial<{ title: string; body: string; isActive: boolean }>,
): Promise<void> {
  await db()
    .update(adminReplyTemplates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(adminReplyTemplates.id, id));
}

export async function drizzleDeleteReplyTemplate(id: string): Promise<void> {
  await db()
    .delete(adminReplyTemplates)
    .where(eq(adminReplyTemplates.id, id));
}

export async function drizzleGetTicketLabels(
  ticketId: string,
): Promise<SupportTicketLabelMapped[]> {
  const rows = await db()
    .select({
      id: supportTicketLabels.id,
      ticketId: supportTicketLabels.ticketId,
      label: supportTicketLabels.label,
      createdAt: supportTicketLabels.createdAt,
      createdBy: supportTicketLabels.createdBy,
      displayName: adminUsers.displayName,
      email: adminUsers.email,
    })
    .from(supportTicketLabels)
    .leftJoin(adminUsers, eq(supportTicketLabels.createdBy, adminUsers.id))
    .where(eq(supportTicketLabels.ticketId, ticketId))
    .orderBy(desc(supportTicketLabels.createdAt));

  return rows.map((row) =>
    mapSupportTicketLabelRow(
      {
        id: row.id,
        ticketId: row.ticketId,
        label: row.label,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
      },
      row.displayName || row.email || null,
    ),
  );
}

export async function drizzleInsertTicketLabel(input: {
  ticketId: string;
  label: string;
  createdBy: string;
}): Promise<{ ok: true } | { ok: false; duplicate: boolean }> {
  try {
    await db().insert(supportTicketLabels).values({
      ticketId: input.ticketId,
      label: input.label,
      createdBy: input.createdBy,
    });
    return { ok: true };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "23505") {
      return { ok: false, duplicate: true };
    }
    throw error;
  }
}

export async function drizzleGetTicketLabelById(
  labelId: string,
): Promise<{ id: string; ticket_id: string; label: string } | null> {
  const rows = await db()
    .select({
      id: supportTicketLabels.id,
      ticketId: supportTicketLabels.ticketId,
      label: supportTicketLabels.label,
    })
    .from(supportTicketLabels)
    .where(eq(supportTicketLabels.id, labelId))
    .limit(1);
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    ticket_id: rows[0].ticketId,
    label: rows[0].label,
  };
}

export async function drizzleDeleteTicketLabel(labelId: string): Promise<void> {
  await db()
    .delete(supportTicketLabels)
    .where(eq(supportTicketLabels.id, labelId));
}

export async function drizzleGetTicketHistory(
  ticketId: string,
): Promise<
  Array<{
    id: string;
    action: string;
    created_at: string;
    admin_id: string | null;
    admin_name: string | null;
    details: Record<string, unknown> | null;
  }>
> {
  const rows = await db()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      adminId: auditLogs.adminId,
      details: auditLogs.details,
      displayName: adminUsers.displayName,
      email: adminUsers.email,
    })
    .from(auditLogs)
    .leftJoin(adminUsers, eq(auditLogs.adminId, adminUsers.id))
    .where(
      and(
        eq(auditLogs.entityType, "support_tickets"),
        eq(auditLogs.entityId, ticketId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    admin_id: row.adminId,
    admin_name: row.displayName || row.email || null,
    details:
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : null,
  }));
}

export async function drizzleGetRecentAdminNotifications(
  sinceIso: string,
): Promise<
  Array<{ admin_id: string | null; metadata: Record<string, unknown> | null }>
> {
  const rows = await db()
    .select({
      adminId: adminNotifications.adminId,
      metadata: adminNotifications.metadata,
    })
    .from(adminNotifications)
    .where(
      and(
        eq(adminNotifications.type, "SYSTEM_ALERT"),
        gte(adminNotifications.createdAt, new Date(sinceIso)),
      ),
    );
  return rows.map((row) => ({
    admin_id: row.adminId,
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  }));
}

export async function drizzleInsertAdminNotifications(
  inserts: Array<{
    admin_id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  if (!inserts.length) return;
  await db().insert(adminNotifications).values(
    inserts.map((row) => ({
      adminId: row.admin_id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: row.read,
      metadata: row.metadata,
    })),
  );
}

export async function drizzleInsertUserNotification(input: {
  tenantId: string;
  userId: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await db().insert(userNotifications).values({
    tenantId: input.tenantId,
    userId: input.userId,
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    metadata: input.metadata,
  });
}

export async function drizzleListAssignedTickets(
  adminIds: string[],
): Promise<
  Array<{
    id: string;
    assigned_admin_id: string | null;
    status: string;
    priority: string;
    created_at: string;
    resolved_at: string | null;
  }>
> {
  if (!adminIds.length) return [];
  const rows = await db()
    .select({
      id: supportTickets.id,
      assignedAdminId: supportTickets.assignedAdminId,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      resolvedAt: supportTickets.resolvedAt,
    })
    .from(supportTickets)
    .where(inArray(supportTickets.assignedAdminId, adminIds));
  return rows.map((row) => ({
    id: row.id,
    assigned_admin_id: row.assignedAdminId,
    status: row.status,
    priority: row.priority,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    resolved_at: row.resolvedAt
      ? row.resolvedAt instanceof Date
        ? row.resolvedAt.toISOString()
        : String(row.resolvedAt)
      : null,
  }));
}

export async function drizzleGetStaleCandidateTickets(): Promise<
  Array<{
    id: string;
    status: string;
    priority: string;
    assigned_admin_id: string | null;
    created_at: string;
  }>
> {
  const rows = await db()
    .select({
      id: supportTickets.id,
      status: supportTickets.status,
      priority: supportTickets.priority,
      assignedAdminId: supportTickets.assignedAdminId,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(
      and(
        inArray(supportTickets.status, [...ACTIVE_TICKET_STATUSES]),
        isNotNull(supportTickets.assignedAdminId),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    priority: row.priority,
    assigned_admin_id: row.assignedAdminId,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Legacy alerts (admin reports / analytics — deferred from F3e)
// ---------------------------------------------------------------------------

export async function drizzleListAlertsForReport(input?: {
  startDate?: string;
  endDate?: string;
}): Promise<
  Array<
    Pick<
      AlertMapped,
      "user_id" | "type" | "severity" | "message" | "status" | "created_at"
    >
  >
> {
  const conditions: import("drizzle-orm").SQL[] = [];
  if (input?.startDate) {
    conditions.push(gte(alerts.createdAt, new Date(input.startDate)));
  }
  if (input?.endDate) {
    conditions.push(lte(alerts.createdAt, new Date(input.endDate)));
  }
  const query = db()
    .select({
      userId: alerts.userId,
      type: alerts.type,
      severity: alerts.severity,
      message: alerts.message,
      status: alerts.status,
      createdAt: alerts.createdAt,
      id: alerts.id,
      periodStart: alerts.periodStart,
      sentAt: alerts.sentAt,
      tenantId: alerts.tenantId,
    })
    .from(alerts);
  const rows = conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(alerts.createdAt))
    : await query.orderBy(desc(alerts.createdAt));
  return rows.map((row) => {
    const mapped = mapAlertRow(row);
    return {
      user_id: mapped.user_id,
      type: mapped.type,
      severity: mapped.severity,
      message: mapped.message,
      status: mapped.status,
      created_at: mapped.created_at,
    };
  });
}

export async function drizzleCountAlertsByType(): Promise<
  Array<{ type: string; count: number }>
> {
  const rows = await db()
    .select({
      type: alerts.type,
      count: sql<number>`count(*)::int`,
    })
    .from(alerts)
    .groupBy(alerts.type);
  return rows.map((row) => ({ type: row.type, count: Number(row.count) || 0 }));
}
