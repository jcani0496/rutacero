'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
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
 * Implementation notes:
 *
 * - We resolve the calling user via the SSR client (`createClient`) because
 *   that's the only client with the user's auth cookie.
 * - We perform the actual write via the ADMIN client (`createAdminClient`).
 *   Calling `supabase.auth.updateUser(...)` on the SSR client from a server
 *   action causes Supabase to issue a session-refresh cookie, which the SSR
 *   helper tries to persist via cookieStore.set. The cookie-write path is
 *   inside a try/catch that silently swallows errors, so any failure on
 *   that path produces a thrown exception with no surface signal to the UI
 *   (which is exactly what the user saw: click Save → nothing happens, no
 *   toast). Using `auth.admin.updateUserById` writes the metadata directly
 *   via the service role without touching session cookies.
 * - We write both `full_name` (our canonical key) and `name` (the OAuth
 *   convention) so getDisplayName produces a consistent result regardless
 *   of which lookup path a surface uses.
 * - We MERGE with existing user_metadata rather than replacing it —
 *   admin.updateUserById's `user_metadata` is a full-object replacement.
 * - revalidatePath('/', 'layout') flushes the user fetch in the (app)
 *   layout, which is what feeds the header and sidebar — without it the
 *   new name only shows after a manual reload.
 * - The whole body is wrapped in try/catch so any future failure mode still
 *   returns a structured error the UI can render, instead of throwing
 *   through React 19's useTransition (which silently swallows rejected
 *   async transitions).
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
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { success: false, error: 'No autenticado.' };
        }

        const existingMetadata =
            user.user_metadata && typeof user.user_metadata === 'object'
                ? (user.user_metadata as Record<string, unknown>)
                : {};

        const admin = createAdminClient();
        const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...existingMetadata,
                full_name: trimmed,
                name: trimmed,
            },
        });

        if (updateError) {
            logger.error(
                { err: updateError, userId: user.id },
                '[profile] updateDisplayName admin update failed',
            );
            return { success: false, error: 'No se pudo guardar tu nombre. Intenta de nuevo.' };
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
