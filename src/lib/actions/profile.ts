'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { getAppUser } from '@/lib/auth/session';
import { updateIdentityUser } from '@/lib/auth/identity';
import { logger } from '@/lib/logger';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { mapUserProfileRow, type UserProfileMapped } from '@/lib/data/mappers';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/db/client';
import { userProfiles } from '@/db/schema';
import type { Currency, GoalType, PayFrequency } from '@/types';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;

export interface UpdateDisplayNameResult {
    success: boolean;
    error?: string;
}

export type ProfilePreferencesInput = {
    currency_base: Currency;
    goal_type: GoalType;
    motivation_level: number;
    risk_tolerance: number;
    safety_buffer_pct: number;
};

export type CompleteOnboardingInput = {
    currency_base: Currency;
    pay_frequency: PayFrequency;
    pay_dates: number[];
    goal_type: GoalType;
    onboarding_motivation: 'STRESSED' | 'SAVE_INTEREST' | 'BIG_PURCHASE' | 'UNDERSTAND_NUMBERS' | null;
    timezone: string;
};

export type ProfileActionResult = {
    success: boolean;
    error?: string;
};

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

/**
 * Loads the current user's profile (snake_case UI contract).
 * Dual-path behind DATA_PROVIDER; default stays PostgREST.
 */
export async function getCurrentUserProfile(): Promise<UserProfileMapped | null> {
    const appUser = await getAppUser();
    if (!appUser) {
        return null;
    }

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [row] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.userId, appUser.id))
            .limit(1);
        return row ? mapUserProfileRow(row) : null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', appUser.id)
        .maybeSingle();

    if (error) {
        logger.error({ err: error, userId: appUser.id }, '[profile] getCurrentUserProfile failed');
        return null;
    }

    if (!data) {
        return null;
    }

    return {
        id: data.id,
        user_id: data.user_id,
        currency_base: data.currency_base as Currency,
        pay_frequency: data.pay_frequency as PayFrequency,
        pay_dates: Array.isArray(data.pay_dates) ? data.pay_dates : [],
        goal_type: data.goal_type as GoalType,
        timezone: data.timezone,
        motivation_level: data.motivation_level ?? undefined,
        risk_tolerance: data.risk_tolerance ?? undefined,
        safety_buffer_pct:
            data.safety_buffer_pct == null ? undefined : Number(data.safety_buffer_pct),
        created_at: data.created_at,
        updated_at: data.updated_at,
        onboarding_completed: Boolean(data.onboarding_completed),
        current_tenant_id: data.current_tenant_id ?? null,
        onboarding_motivation: data.onboarding_motivation ?? null,
        last_active_at: data.last_active_at ?? null,
    };
}

/**
 * Lightweight onboarding gate for login/callback clients.
 */
export async function getOnboardingStatus(): Promise<{ onboardingCompleted: boolean } | null> {
    const profile = await getCurrentUserProfile();
    if (!profile) {
        return { onboardingCompleted: false };
    }
    return { onboardingCompleted: Boolean(profile.onboarding_completed) };
}

/**
 * Updates preference fields from Settings (not display name).
 */
export async function updateUserProfilePreferences(
    input: ProfilePreferencesInput,
): Promise<ProfileActionResult> {
    const appUser = await getAppUser();
    if (!appUser) {
        return { success: false, error: 'No autenticado.' };
    }

    const motivation = Number.isFinite(input.motivation_level)
        ? Math.min(5, Math.max(1, Math.round(input.motivation_level)))
        : 3;
    const risk = Number.isFinite(input.risk_tolerance)
        ? Math.min(5, Math.max(1, Math.round(input.risk_tolerance)))
        : 3;
    const safety = Number.isFinite(input.safety_buffer_pct)
        ? Math.min(50, Math.max(0, input.safety_buffer_pct))
        : 10;

    try {
        if (isDrizzleEnabled()) {
            const db = getDb();
            const updated = await db
                .update(userProfiles)
                .set({
                    currencyBase: input.currency_base,
                    goalType: input.goal_type,
                    motivationLevel: motivation,
                    riskTolerance: risk,
                    safetyBufferPct: String(safety),
                    updatedAt: sql`now()`,
                })
                .where(eq(userProfiles.userId, appUser.id))
                .returning({ id: userProfiles.id });

            if (updated.length === 0) {
                return { success: false, error: 'Perfil no encontrado.' };
            }
        } else {
            const supabase = await createClient();
            const { error } = await supabase
                .from('user_profiles')
                .update({
                    currency_base: input.currency_base,
                    goal_type: input.goal_type,
                    motivation_level: motivation,
                    risk_tolerance: risk,
                    safety_buffer_pct: safety,
                })
                .eq('user_id', appUser.id);

            if (error) {
                logger.error({ err: error, userId: appUser.id }, '[profile] update preferences failed');
                return { success: false, error: error.message || 'No se pudo guardar la configuración.' };
            }
        }

        revalidatePath('/settings');
        revalidatePath('/profile');
        revalidatePath('/dashboard');
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (err) {
        logger.error({ err, userId: appUser.id }, '[profile] updateUserProfilePreferences threw');
        return { success: false, error: 'No se pudo guardar la configuración. Intenta de nuevo.' };
    }
}

/**
 * Upserts onboarding fields and marks onboarding complete.
 */
export async function completeOnboardingProfile(
    input: CompleteOnboardingInput,
): Promise<ProfileActionResult> {
    const appUser = await getAppUser();
    if (!appUser) {
        return { success: false, error: 'No autenticado.' };
    }

    try {
        if (isDrizzleEnabled()) {
            const db = getDb();
            await db
                .insert(userProfiles)
                .values({
                    userId: appUser.id,
                    currencyBase: input.currency_base,
                    payFrequency: input.pay_frequency,
                    payDates: input.pay_dates,
                    goalType: input.goal_type,
                    onboardingMotivation: input.onboarding_motivation,
                    onboardingCompleted: true,
                    timezone: input.timezone,
                })
                .onConflictDoUpdate({
                    target: userProfiles.userId,
                    set: {
                        currencyBase: input.currency_base,
                        payFrequency: input.pay_frequency,
                        payDates: input.pay_dates,
                        goalType: input.goal_type,
                        onboardingMotivation: input.onboarding_motivation,
                        onboardingCompleted: true,
                        timezone: input.timezone,
                        updatedAt: sql`now()`,
                    },
                });
        } else {
            const supabase = await createClient();
            const { error } = await supabase.from('user_profiles').upsert(
                {
                    user_id: appUser.id,
                    currency_base: input.currency_base,
                    pay_frequency: input.pay_frequency,
                    pay_dates: input.pay_dates,
                    goal_type: input.goal_type,
                    onboarding_motivation: input.onboarding_motivation,
                    onboarding_completed: true,
                    timezone: input.timezone,
                },
                { onConflict: 'user_id' },
            );

            if (error) {
                logger.error({ err: error, userId: appUser.id }, '[profile] completeOnboarding failed');
                return { success: false, error: error.message || 'No se pudo completar el onboarding.' };
            }
        }

        revalidatePath('/onboarding');
        revalidatePath('/dashboard');
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (err) {
        logger.error({ err, userId: appUser.id }, '[profile] completeOnboardingProfile threw');
        return { success: false, error: 'No se pudo completar el onboarding. Intenta de nuevo.' };
    }
}
