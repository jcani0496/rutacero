'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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
            // Fallback for older call paths that only have Supabase session.
            const supabase = await createClient();
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                return { success: false, error: 'No autenticado.' };
            }
            await updateIdentityUser(user.id, { name: trimmed });
        } else {
            await updateIdentityUser(appUser.id, { name: trimmed });
        }

        revalidatePath('/profile');
        revalidatePath('/dashboard');
        revalidatePath('/', 'layout');

        return { success: true };
    } catch (err) {
        logger.error(
            { err },
            '[profile] updateDisplayName threw unexpected error',
        );
        return { success: false, error: 'Error inesperado al guardar. Intenta de nuevo.' };
    }
}
