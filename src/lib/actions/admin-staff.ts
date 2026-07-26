'use server';

import bcrypt from 'bcryptjs';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { logAdminAction, requirePermission, type AdminRole } from '@/lib/actions/admin-auth';
import { logger } from '@/lib/logger';

export interface StaffUser {
    id: string;
    email: string;
    display_name: string | null;
    role: AdminRole;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
}

export async function getAdminStaff(search?: string): Promise<StaffUser[]> {
    await requirePermission('staff:read');

    let staff: StaffUser[];
    try {
        const db = getDb();
        const rows = await db
            .select({
                id: schema.adminUsers.id,
                email: schema.adminUsers.email,
                displayName: schema.adminUsers.displayName,
                role: schema.adminUsers.role,
                isActive: schema.adminUsers.isActive,
                lastLoginAt: schema.adminUsers.lastLoginAt,
                createdAt: schema.adminUsers.createdAt,
            })
            .from(schema.adminUsers)
            .orderBy(desc(schema.adminUsers.createdAt));

        staff = rows.map((row) => ({
            id: row.id,
            email: row.email,
            display_name: row.displayName,
            role: row.role as AdminRole,
            is_active: row.isActive,
            last_login_at: row.lastLoginAt?.toISOString() ?? null,
            created_at: row.createdAt.toISOString(),
        }));
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching admin staff');
        return [];
    }

    if (!search) return staff;

    const searchLower = search.toLowerCase();
    return staff.filter((member) =>
        member.email.toLowerCase().includes(searchLower)
        || (member.display_name || '').toLowerCase().includes(searchLower)
    );
}

export async function createAdminStaff(input: {
    email: string;
    displayName: string;
    role: AdminRole;
    password: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('staff:create');

    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const password = input.password.trim();

    if (!email || !password) {
        return { success: false, error: 'Email y contraseña son obligatorios.' };
    }

    try {
        const db = getDb();
        const [existing] = await db
            .select({ id: schema.adminUsers.id })
            .from(schema.adminUsers)
            .where(eq(schema.adminUsers.email, email))
            .limit(1);

        if (existing?.id) {
            return { success: false, error: 'Ya existe un usuario con ese email.' };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await db.insert(schema.adminUsers).values({
            email,
            displayName: displayName || null,
            passwordHash,
            role: input.role,
            isActive: true,
        });
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating admin staff');
        return { success: false, error: 'No se pudo crear el usuario.' };
    }

    await logAdminAction(session.adminId, 'CREATE_ADMIN_USER', 'admin_users', undefined, {
        email,
        role: input.role,
    });

    return { success: true };
}

export async function updateAdminStaff(input: {
    id: string;
    displayName?: string;
    role?: AdminRole;
    isActive?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('staff:update');

    if (!input.id) {
        return { success: false, error: 'Usuario inválido.' };
    }

    if (input.id === session.adminId) {
        if (input.role && input.role !== session.role) {
            return { success: false, error: 'No puedes cambiar tu propio rol.' };
        }
        if (typeof input.isActive === 'boolean' && !input.isActive) {
            return { success: false, error: 'No puedes desactivar tu propio usuario.' };
        }
    }

    const updates: Partial<typeof schema.adminUsers.$inferInsert> = {};
    const auditDetails: Record<string, unknown> = {};
    if (typeof input.displayName === 'string') {
        updates.displayName = input.displayName.trim() || null;
        auditDetails.display_name = updates.displayName;
    }
    if (input.role) {
        updates.role = input.role;
        auditDetails.role = input.role;
    }
    if (typeof input.isActive === 'boolean') {
        updates.isActive = input.isActive;
        auditDetails.is_active = input.isActive;
    }

    if (Object.keys(updates).length === 0) {
        return { success: false, error: 'Sin cambios para aplicar.' };
    }

    try {
        const db = getDb();
        await db
            .update(schema.adminUsers)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(schema.adminUsers.id, input.id));
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error updating admin staff');
        return { success: false, error: 'No se pudo actualizar el usuario.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_ADMIN_USER', 'admin_users', input.id, auditDetails);

    return { success: true };
}

export async function resetAdminStaffPassword(input: {
    id: string;
    password: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('staff:update');

    const password = input.password.trim();
    if (!input.id || !password) {
        return { success: false, error: 'Datos inválidos.' };
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const db = getDb();
        await db
            .update(schema.adminUsers)
            .set({
                passwordHash,
                passwordRotatedAt: new Date(),
                mustRotatePassword: false,
                updatedAt: new Date(),
            })
            .where(eq(schema.adminUsers.id, input.id));
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error resetting admin password');
        return { success: false, error: 'No se pudo actualizar la contraseña.' };
    }

    await logAdminAction(session.adminId, 'RESET_ADMIN_PASSWORD', 'admin_users', input.id);

    return { success: true };
}
