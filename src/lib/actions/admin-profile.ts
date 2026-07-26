'use server';

import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import {
    logAdminAction,
    refreshAdminSession,
    requireAdminAuth,
    type AdminSession,
} from '@/lib/actions/admin-auth';

const ADMIN_DISPLAY_NAME_MIN = 2;
const ADMIN_DISPLAY_NAME_MAX = 80;
const ADMIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateAdminProfile(input: {
    displayName: string;
    email: string;
}): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
    const session = await requireAdminAuth();
    const displayName = input.displayName.trim();
    const email = input.email.trim().toLowerCase();

    if (displayName.length < ADMIN_DISPLAY_NAME_MIN) {
        return { success: false, error: 'Nombre demasiado corto (mínimo 2 caracteres).' };
    }
    if (displayName.length > ADMIN_DISPLAY_NAME_MAX) {
        return { success: false, error: `Nombre demasiado largo (máximo ${ADMIN_DISPLAY_NAME_MAX} caracteres).` };
    }
    if (!email || !ADMIN_EMAIL_RE.test(email)) {
        return { success: false, error: 'Email inválido.' };
    }

    const db = getDb();

    if (email !== session.email) {
        const [existing] = await db
            .select({ id: schema.adminUsers.id })
            .from(schema.adminUsers)
            .where(eq(schema.adminUsers.email, email))
            .limit(1);

        if (existing && existing.id !== session.adminId) {
            return { success: false, error: 'Ya existe un admin con ese email.' };
        }
    }

    try {
        await db
            .update(schema.adminUsers)
            .set({
                displayName,
                email,
                updatedAt: new Date(),
            })
            .where(eq(schema.adminUsers.id, session.adminId));
    } catch {
        return { success: false, error: 'No se pudo actualizar el perfil.' };
    }

    const updatedSession: AdminSession = {
        adminId: session.adminId,
        email,
        role: session.role,
        displayName,
    };

    try {
        await refreshAdminSession(updatedSession);
    } catch {
        return { success: false, error: 'Perfil guardado pero no se pudo refrescar la sesión.' };
    }

    await logAdminAction(session.adminId, 'UPDATE_ADMIN_PROFILE', 'admin_users', session.adminId, {
        email,
        displayName,
    });

    return { success: true, session: updatedSession };
}
