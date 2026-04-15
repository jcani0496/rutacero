'use server';

import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction, requirePermission, type AdminRole } from '@/lib/actions/admin-auth';

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
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('admin_users')
        .select('id, email, display_name, role, is_active, last_login_at, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching admin staff:', error?.message || error);
        return [];
    }

    const staff = (data || []) as StaffUser[];
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
    const supabase = await createClient();

    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const password = input.password.trim();

    if (!email || !password) {
        return { success: false, error: 'Email y contraseña son obligatorios.' };
    }

    const { data: existing } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (existing?.id) {
        return { success: false, error: 'Ya existe un usuario con ese email.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { error } = await supabase
        .from('admin_users')
        .insert({
            email,
            display_name: displayName || null,
            password_hash: passwordHash,
            role: input.role,
            is_active: true,
        });

    if (error) {
        console.error('Error creating admin staff:', error?.message || error);
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
    const supabase = await createClient();

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

    const updates: Record<string, unknown> = {};
    if (typeof input.displayName === 'string') {
        updates.display_name = input.displayName.trim() || null;
    }
    if (input.role) {
        updates.role = input.role;
    }
    if (typeof input.isActive === 'boolean') {
        updates.is_active = input.isActive;
    }

    if (Object.keys(updates).length === 0) {
        return { success: false, error: 'Sin cambios para aplicar.' };
    }

    const { error } = await supabase
        .from('admin_users')
        .update(updates)
        .eq('id', input.id);

    if (error) {
        console.error('Error updating admin staff:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar el usuario.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_ADMIN_USER', 'admin_users', input.id, updates);

    return { success: true };
}

export async function resetAdminStaffPassword(input: {
    id: string;
    password: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('staff:update');
    const supabase = await createClient();

    const password = input.password.trim();
    if (!input.id || !password) {
        return { success: false, error: 'Datos inválidos.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { error } = await supabase
        .from('admin_users')
        .update({
            password_hash: passwordHash,
            password_rotated_at: new Date().toISOString(),
            must_rotate_password: false,
        })
        .eq('id', input.id);

    if (error) {
        console.error('Error resetting admin password:', error?.message || error);
        return { success: false, error: 'No se pudo actualizar la contraseña.' };
    }

    await logAdminAction(session.adminId, 'RESET_ADMIN_PASSWORD', 'admin_users', input.id);

    return { success: true };
}
