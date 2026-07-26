'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import {
  subscriptions,
  tenantMemberships,
  tenants,
  userProfiles,
} from '@/db/schema';
import { getAppUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { ensureCurrentTenantForUser } from '@/lib/tenant/server';

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export async function getMyTenants(): Promise<{
  tenants: TenantSummary[];
  currentTenantId: string | null;
}> {
  const appUser = await getAppUser();
  if (!appUser) return { tenants: [], currentTenantId: null };

  // Ensure bootstrap exists, so at least the personal tenant is present.
  const ensuredTenantId = await ensureCurrentTenantForUser(appUser.id);
  const db = getDb();

  const [profile] = await db
    .select({ currentTenantId: userProfiles.currentTenantId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, appUser.id))
    .limit(1);

  const currentTenantId = profile?.currentTenantId || ensuredTenantId;

  try {
    const rows = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        role: tenantMemberships.role,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .where(eq(tenantMemberships.userId, appUser.id));

    return {
      tenants: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        role: row.role as TenantSummary['role'],
      })),
      currentTenantId,
    };
  } catch (err) {
    logger.error({ err, userId: appUser.id }, '[tenants] getMyTenants failed');
    return { tenants: [], currentTenantId };
  }
}

export async function switchTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const appUser = await getAppUser();
  if (!appUser) return { success: false, error: 'No autenticado' };

  const db = getDb();

  try {
    // Verify membership first.
    const [membership] = await db
      .select({ tenantId: tenantMemberships.tenantId })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, appUser.id),
        ),
      )
      .limit(1);

    if (!membership) {
      return { success: false, error: 'No eres miembro de este workspace' };
    }

    await db
      .update(userProfiles)
      .set({ currentTenantId: tenantId, updatedAt: sql`now()` })
      .where(eq(userProfiles.userId, appUser.id));
  } catch (err) {
    logger.error({ err, userId: appUser.id, tenantId }, '[tenants] switchTenant failed');
    return { success: false, error: 'No se pudo cambiar el workspace' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/workspaces');

  return { success: true };
}

export async function createWorkspace(name: string): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  const appUser = await getAppUser();
  if (!appUser) return { success: false, error: 'No autenticado' };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Nombre requerido' };

  const slugBase = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const slug = `${slugBase || 'workspace'}-${appUser.id.slice(0, 8)}`;

  const db = getDb();

  try {
    const [tenant] = await db
      .insert(tenants)
      .values({
        slug,
        name: trimmed,
        createdByUserId: appUser.id,
      })
      .returning({ id: tenants.id });

    if (!tenant?.id) {
      return { success: false, error: 'No se pudo crear el workspace' };
    }

    const tenantId = tenant.id;

    // Bootstrap membership (OWNER).
    await db
      .insert(tenantMemberships)
      .values({ tenantId, userId: appUser.id, role: 'OWNER' })
      .onConflictDoUpdate({
        target: [tenantMemberships.tenantId, tenantMemberships.userId],
        set: { role: 'OWNER' },
      });

    // Switch to new workspace.
    await db
      .update(userProfiles)
      .set({ currentTenantId: tenantId, updatedAt: sql`now()` })
      .where(eq(userProfiles.userId, appUser.id));

    // Ensure subscription row exists (FREE by default). Billing updates still come from the webhook.
    await db
      .insert(subscriptions)
      .values({
        tenantId,
        userId: appUser.id,
        purchaserUserId: appUser.id,
        planCode: 'FREE',
        status: 'ACTIVE',
      })
      .onConflictDoNothing({ target: subscriptions.tenantId });

    revalidatePath('/workspaces');

    return { success: true, tenantId };
  } catch (err) {
    logger.error({ err, userId: appUser.id }, '[tenants] createWorkspace failed');
    return { success: false, error: 'No se pudo crear el workspace' };
  }
}
