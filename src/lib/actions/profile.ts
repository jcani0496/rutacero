'use server';

import { revalidatePath } from 'next/cache';
import { getAppUser } from '@/lib/auth/session';
import { updateIdentityUser } from '@/lib/auth/identity';
import { logger } from '@/lib/logger';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;

export interface UpdateDisplayNameResult {
    success: boolean;
    error?: string;
}

/**
 * Updates the current user's display name.
 * Uses the identity adapter so both Supabase Auth and better-auth paths work.
 */
export async function updateDisplayName(input: { fullName: string }): Promise<UpdateDisplayNameResult> {
    const trimmed = input?.fullName?.trim() ?? '';

    if (trimmed.length < DISPLAY_NAME_MIN) {
        return { success: false, error: 'Nombre demasiado corto (mínimo 2 caracteres).' };
    }
    if (trimmed.length > DISPLAY_NAME_MAX) {
        return { success: false, error: `Nombre demasiado largo (máximo ${DISPLAY_NAME_MAX} caracteres).` };
    }

    try {
        const appUser = await getAppUser();
        if (!appUser) {
            return { success: false, error: 'No autenticado.' };
        }

        await updateIdentityUser(appUser.id, { name: trimmed });

        revalidatePath('/profile');
        revalidatePath('/dashboard');
        revalidatePath('/', 'layout');

        return { success: true };
    } catch (err) {
        logger.error(
            { err },
            '[profile] updateDisplayName threw unexpected error',
        );
        return { success: false, error: 'No se pudo guardar el nombre. Intenta de nuevo.' };
    }
}
