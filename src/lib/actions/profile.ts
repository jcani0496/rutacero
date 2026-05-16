'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;

export interface UpdateDisplayNameResult {
    success: boolean;
    error?: string;
}

/**
 * Updates the current user's display name in auth.user_metadata.
 *
 * We write to both `full_name` (our canonical key) and `name` (the OAuth
 * convention) so getDisplayName produces a consistent result regardless of
 * which lookup path a surface uses. revalidatePath('/', 'layout') flushes
 * the user fetch in the (app) layout, which is what feeds the header and
 * sidebar — without it the new name only shows after a manual reload.
 */
export async function updateDisplayName(input: { fullName: string }): Promise<UpdateDisplayNameResult> {
    const trimmed = input?.fullName?.trim() ?? '';

    if (trimmed.length < DISPLAY_NAME_MIN) {
        return { success: false, error: 'Nombre demasiado corto (mínimo 2 caracteres).' };
    }
    if (trimmed.length > DISPLAY_NAME_MAX) {
        return { success: false, error: `Nombre demasiado largo (máximo ${DISPLAY_NAME_MAX} caracteres).` };
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { success: false, error: 'No autenticado.' };
    }

    const { error: updateError } = await supabase.auth.updateUser({
        data: {
            full_name: trimmed,
            name: trimmed,
        },
    });

    if (updateError) {
        logger.error(
            { err: updateError, userId: user.id },
            '[profile] updateDisplayName failed',
        );
        return { success: false, error: 'No se pudo guardar tu nombre. Intenta de nuevo.' };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');
    // Refreshes the (app) layout-level user fetch so header + sidebar update
    // without a full page reload.
    revalidatePath('/', 'layout');

    return { success: true };
}
