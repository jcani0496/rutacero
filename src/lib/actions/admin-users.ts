'use server';

import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { requirePermission, logAdminAction } from './admin-auth';
import { ensureCurrentTenantForUser } from '@/lib/tenant/server';
import { getDisplayName } from '@/lib/auth/display-name';
import { logger } from '@/lib/logger';
import { evaluateUserWorkingCurrencyChange } from '@/lib/currency/working-currency-server';
import { WORKING_CURRENCY_ADMIN_LOCKED_MESSAGE } from '@/lib/currency/working-currency';

async function getOrEnsureCurrentTenantIdForUser(userId: string) {
    const db = getDb();
    const [profile] = await db
        .select({ currentTenantId: schema.userProfiles.currentTenantId })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

    if (profile?.currentTenantId) return profile.currentTenantId;

    try {
        return await ensureCurrentTenantForUser(userId);
    } catch {
        return null;
    }
}

// ============================================
// TYPES
// ============================================

export interface UserListItem {
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    debt_count: number;
    total_debt: number;
    subscription_plan: string;
    banned_until: string | null;
    // Status fields
    email_confirmed: boolean;
    onboarding_completed: boolean;
    is_active: boolean; // Active in last 30 days
}

export interface UserDetails extends UserListItem {
    profile: UserProfileData | null;
    subscription: UserSubscriptionData | null;
    debts: Array<{
        id: string;
        creditor: string;
        balance: number;
        type: string;
    }>;
    payments_count: number;
    plan_active: boolean;
}

export interface UserProfileData {
    currency_base: string;
    pay_frequency: string;
    pay_dates: number[];
    goal_type: string;
    timezone: string;
    onboarding_completed: boolean;
}

export interface UserSubscriptionData {
    plan_code: string;
    status: string;
    provider: string | null;
    external_id: string | null;
    renew_at: string | null;
    cancel_at: string | null;
}

export interface UserAdminInput {
    email: string;
    display_name: string;
    password?: string;
    email_confirmed?: boolean;
    profile: UserProfileData;
    subscription: UserSubscriptionData;
}

const DEFAULT_PROFILE: UserProfileData = {
    currency_base: 'GTQ',
    pay_frequency: 'BIWEEKLY',
    pay_dates: [15, 30],
    goal_type: 'BALANCED',
    timezone: 'America/Guatemala',
    onboarding_completed: false,
};

const DEFAULT_SUBSCRIPTION: UserSubscriptionData = {
    plan_code: 'FREE',
    status: 'ACTIVE',
    provider: 'internal',
    external_id: null,
    renew_at: null,
    cancel_at: null,
};

const normalizePayDates = (value: string | number[] | undefined, fallback: number[] = DEFAULT_PROFILE.pay_dates) => {
    if (Array.isArray(value)) {
        const cleaned = value
            .map((entry) => Number(entry))
            .filter((entry) => Number.isFinite(entry))
            .map((entry) => Math.trunc(entry))
            .filter((entry) => entry >= 1 && entry <= 31);

        return cleaned.length ? Array.from(new Set(cleaned)) : fallback;
    }

    if (!value) return fallback;

    const cleaned = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.trunc(entry))
        .filter((entry) => entry >= 1 && entry <= 31);

    return cleaned.length ? Array.from(new Set(cleaned)) : fallback;
};

const normalizeOptionalDate = (value: string | null | undefined) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
};

// ============================================
// GET USERS LIST
// ============================================

export async function getUsers(options?: {
    search?: string;
    page?: number;
    limit?: number;
}): Promise<{ users: UserListItem[]; total: number }> {
    await requirePermission('users:read');

    const page = options?.page || 1;
    const perPage = options?.limit || 20;

    try {
        const { listIdentityUsers } = await import('@/lib/auth/identity');
        const authResponse = await listIdentityUsers({
            page,
            perPage,
            search: options?.search,
        });

        if (!authResponse.users.length) {
            return { users: [], total: authResponse.total };
        }

        const db = getDb();
        const userIds = authResponse.users.map((u) => u.id);

        const profiles = await db
            .select({
                userId: schema.userProfiles.userId,
                onboardingCompleted: schema.userProfiles.onboardingCompleted,
                currentTenantId: schema.userProfiles.currentTenantId,
            })
            .from(schema.userProfiles)
            .where(inArray(schema.userProfiles.userId, userIds));

        const profileMap = new Map(profiles.map((p) => [p.userId, p]));

        const tenantIds = Array.from(
            new Set(profiles.map((p) => p.currentTenantId).filter((id): id is string => !!id)),
        );

        const subscriptions = tenantIds.length
            ? await db
                .select({
                    tenantId: schema.subscriptions.tenantId,
                    planCode: schema.subscriptions.planCode,
                })
                .from(schema.subscriptions)
                .where(
                    and(
                        inArray(schema.subscriptions.tenantId, tenantIds),
                        eq(schema.subscriptions.status, 'ACTIVE'),
                    ),
                )
            : [];

        const subscriptionMap = new Map(subscriptions.map((s) => [s.tenantId, s.planCode]));

        // One batched debt query for the whole page instead of a query per
        // user (audit 2026-07, perf P1: N+1).
        const allDebts = await db
            .select({ userId: schema.debts.userId, balance: schema.debts.balance })
            .from(schema.debts)
            .where(and(inArray(schema.debts.userId, userIds), eq(schema.debts.status, 'ACTIVE')));

        const debtsByUser = new Map<string, { count: number; total: number }>();
        for (const debt of allDebts) {
            const entry = debtsByUser.get(debt.userId) ?? { count: 0, total: 0 };
            entry.count += 1;
            entry.total += Number(debt.balance) || 0;
            debtsByUser.set(debt.userId, entry);
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const users: UserListItem[] = authResponse.users.map((authUser) => {
            const debtEntry = debtsByUser.get(authUser.id);
            const displayName =
                authUser.name ||
                (authUser.raw
                    ? getDisplayName(authUser.raw as Parameters<typeof getDisplayName>[0])
                    : null);

            const profile = profileMap.get(authUser.id);
            const lastSignIn = authUser.lastSignInAt ? new Date(authUser.lastSignInAt) : null;

            return {
                id: authUser.id,
                email: authUser.email || '',
                display_name: displayName,
                created_at: authUser.createdAt,
                last_sign_in_at: authUser.lastSignInAt,
                debt_count: debtEntry?.count || 0,
                total_debt: debtEntry?.total || 0,
                subscription_plan: String(
                    profile?.currentTenantId
                        ? (subscriptionMap.get(profile.currentTenantId) || 'FREE')
                        : 'FREE',
                ),
                banned_until: authUser.bannedUntil,
                email_confirmed: authUser.emailVerified,
                onboarding_completed: profile?.onboardingCompleted || false,
                is_active: lastSignIn ? lastSignIn >= thirtyDaysAgo : false,
            };
        });

        return { users, total: authResponse.total };
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching admin users');
        return { users: [], total: 0 };
    }
}

// ============================================
// GET USER DETAILS
// ============================================

export async function getUserDetails(userId: string): Promise<UserDetails | null> {
    const session = await requirePermission('users:read');

    const { getIdentityUserById } = await import('@/lib/auth/identity');
    const identityUser = await getIdentityUserById(userId);

    if (!identityUser) {
        logger.error({ userId }, 'Error fetching user');
        return null;
    }

    const authUser = (identityUser.raw ?? {
        id: identityUser.id,
        email: identityUser.email,
        created_at: identityUser.createdAt,
        last_sign_in_at: identityUser.lastSignInAt,
        email_confirmed_at: identityUser.emailVerified ? identityUser.createdAt : null,
        banned_until: identityUser.bannedUntil,
        user_metadata: { full_name: identityUser.name, name: identityUser.name },
    }) as {
        id: string;
        email?: string | null;
        created_at: string;
        last_sign_in_at?: string | null;
        email_confirmed_at?: string | null;
        banned_until?: string | null;
        user_metadata?: Record<string, unknown>;
    };
    const bannedUntil = authUser.banned_until ?? identityUser.bannedUntil;

    // 🔒 AUDIT LOG: Record access to sensitive financial data
    await logAdminAction(
        session.adminId,
        'VIEW_USER_SENSITIVE_DATA',
        'user',
        userId,
        {
            accessed_fields: ['debts', 'balances', 'payments'],
            user_email: authUser.email
        }
    );

    const db = getDb();

    const [debtRows, paymentsCountRow, activePlanRow, profileRow] = await Promise.all([
        db
            .select({
                id: schema.debts.id,
                creditor: schema.debts.creditor,
                balance: schema.debts.balance,
                type: schema.debts.type,
            })
            .from(schema.debts)
            .where(and(eq(schema.debts.userId, userId), eq(schema.debts.status, 'ACTIVE'))),
        db
            .select({ value: count() })
            .from(schema.payments)
            .where(eq(schema.payments.userId, userId)),
        db
            .select({ id: schema.plans.id })
            .from(schema.plans)
            .where(and(eq(schema.plans.userId, userId), eq(schema.plans.active, true)))
            .limit(1),
        db
            .select({
                currencyBase: schema.userProfiles.currencyBase,
                payFrequency: schema.userProfiles.payFrequency,
                payDates: schema.userProfiles.payDates,
                goalType: schema.userProfiles.goalType,
                timezone: schema.userProfiles.timezone,
                onboardingCompleted: schema.userProfiles.onboardingCompleted,
                currentTenantId: schema.userProfiles.currentTenantId,
            })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.userId, userId))
            .limit(1),
    ]);

    const profile = profileRow[0] ?? null;
    const debts = debtRows.map((d) => ({
        id: d.id,
        creditor: d.creditor,
        balance: Number(d.balance),
        type: d.type,
    }));
    const debtTotal = debts.reduce((sum, d) => sum + d.balance, 0);

    const displayName = getDisplayName(authUser);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const lastSignIn = authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null;
    const isActive = lastSignIn ? lastSignIn >= thirtyDaysAgo : false;

    let subscription: UserSubscriptionData | null = null;

    const tenantIdForSubscription =
        profile?.currentTenantId ?? (await getOrEnsureCurrentTenantIdForUser(userId));

    if (tenantIdForSubscription) {
        const [row] = await db
            .select({
                planCode: schema.subscriptions.planCode,
                status: schema.subscriptions.status,
                provider: schema.subscriptions.provider,
                externalId: schema.subscriptions.externalId,
                renewAt: schema.subscriptions.renewAt,
                cancelAt: schema.subscriptions.cancelAt,
            })
            .from(schema.subscriptions)
            .where(eq(schema.subscriptions.tenantId, tenantIdForSubscription))
            .limit(1);

        if (row) {
            subscription = {
                plan_code: row.planCode,
                status: row.status,
                provider: row.provider ?? null,
                external_id: row.externalId ?? null,
                renew_at: row.renewAt?.toISOString() ?? null,
                cancel_at: row.cancelAt?.toISOString() ?? null,
            };
        }
    }

    return {
        id: userId,
        email: authUser.email || '',
        display_name: displayName,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        debt_count: debts.length,
        total_debt: debtTotal,
        subscription_plan: subscription?.plan_code || 'FREE',
        banned_until: bannedUntil,
        email_confirmed: !!authUser.email_confirmed_at,
        onboarding_completed: profile?.onboardingCompleted || false,
        is_active: isActive,
        profile: profile
            ? {
                currency_base: profile.currencyBase,
                pay_frequency: profile.payFrequency,
                pay_dates: profile.payDates,
                goal_type: profile.goalType,
                timezone: profile.timezone,
                onboarding_completed: profile.onboardingCompleted,
            }
            : null,
        subscription,
        debts,
        payments_count: paymentsCountRow[0]?.value ?? 0,
        plan_active: activePlanRow.length > 0,
    };
}

// ============================================
// BAN / UNBAN USER (ADMIN)
// ============================================

const ALLOWED_BAN_DURATIONS = new Set(['24h', '72h', '168h', '720h', '8760h', 'none']);

export async function setUserBan(
    userId: string,
    duration: string
): Promise<{ success: boolean; error?: string; banned_until?: string | null }> {
    const session = await requirePermission('users:update');

    if (!ALLOWED_BAN_DURATIONS.has(duration)) {
        return { success: false, error: 'Duración de bloqueo inválida' };
    }

    try {
        const { setIdentityUserBan } = await import('@/lib/auth/identity');
        const { bannedUntil } = await setIdentityUserBan(userId, duration);

        await logAdminAction(
            session.adminId,
            duration === 'none' ? 'UNBAN_USER' : 'BAN_USER',
            'users',
            userId,
            { ban_duration: duration }
        );

        return { success: true, banned_until: bannedUntil };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'No se pudo actualizar el ban',
        };
    }
}

// ============================================
// CREATE USER (ADMIN)
// ============================================

export async function createUser(input: UserAdminInput): Promise<{ success: boolean; error?: string; userId?: string }> {
    const session = await requirePermission('users:update');

    const email = input.email.trim().toLowerCase();
    if (!email) return { success: false, error: 'Email inválido' };
    if (!input.password) return { success: false, error: 'La contraseña es requerida' };

    const displayName = input.display_name?.trim() || '';
    const profile = input.profile || DEFAULT_PROFILE;
    const subscription = input.subscription || DEFAULT_SUBSCRIPTION;
    const normalizedProvider = subscription.provider ?? DEFAULT_SUBSCRIPTION.provider ?? 'internal';

    const normalizedPayDates = normalizePayDates(
        profile.pay_dates,
        profile.pay_frequency === 'VARIABLE' ? [] : DEFAULT_PROFILE.pay_dates
    );

    let userId: string;
    try {
        const { createIdentityUser } = await import('@/lib/auth/identity');
        const created = await createIdentityUser({
            email,
            password: input.password,
            name: displayName || undefined,
            emailVerified: input.email_confirmed ?? false,
        });
        userId = created.id;
    } catch (createError) {
        return {
            success: false,
            error: createError instanceof Error ? createError.message : 'No se pudo crear el usuario',
        };
    }

    try {
        const db = getDb();
        await db.insert(schema.userProfiles).values({
            userId,
            currencyBase: profile.currency_base || DEFAULT_PROFILE.currency_base,
            payFrequency: profile.pay_frequency || DEFAULT_PROFILE.pay_frequency,
            payDates: normalizedPayDates,
            goalType: profile.goal_type || DEFAULT_PROFILE.goal_type,
            timezone: profile.timezone || DEFAULT_PROFILE.timezone,
            onboardingCompleted: profile.onboarding_completed ?? false,
        });

        await db
            .update(schema.subscriptions)
            .set({
                planCode: subscription.plan_code || DEFAULT_SUBSCRIPTION.plan_code,
                status: subscription.status || DEFAULT_SUBSCRIPTION.status,
                provider: normalizedProvider,
                externalId: subscription.external_id ?? undefined,
                renewAt: normalizeOptionalDate(subscription.renew_at),
                cancelAt: normalizeOptionalDate(subscription.cancel_at),
                purchaserUserId: userId,
                userId,
                updatedAt: new Date(),
            })
            .where(eq(schema.subscriptions.tenantId, await ensureCurrentTenantForUser(userId)));
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'No se pudo completar el alta del usuario',
        };
    }

    await logAdminAction(session.adminId, 'CREATE_USER', 'users', userId, {
        email,
        plan: subscription.plan_code || DEFAULT_SUBSCRIPTION.plan_code,
    });

    return { success: true, userId };
}

// ============================================
// UPDATE USER (ADMIN)
// ============================================

export async function updateUser(userId: string, input: UserAdminInput): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('users:update');

    const { getIdentityUserById, updateIdentityUser } = await import('@/lib/auth/identity');
    const existingUser = await getIdentityUserById(userId);
    if (!existingUser) {
        return { success: false, error: 'Usuario no encontrado' };
    }

    const email = input.email.trim().toLowerCase();
    const displayName = input.display_name?.trim() || '';
    const profile = input.profile || DEFAULT_PROFILE;
    const subscription = input.subscription || DEFAULT_SUBSCRIPTION;
    const normalizedProvider = subscription.provider ?? DEFAULT_SUBSCRIPTION.provider ?? 'internal';

    const normalizedPayDates = normalizePayDates(
        profile.pay_dates,
        profile.pay_frequency === 'VARIABLE' ? [] : DEFAULT_PROFILE.pay_dates
    );

    const currencyGate = await evaluateUserWorkingCurrencyChange(
        userId,
        profile.currency_base,
        'admin',
    );
    if (!currencyGate.allowed) {
        return {
            success: false,
            error: currencyGate.reason || WORKING_CURRENCY_ADMIN_LOCKED_MESSAGE,
        };
    }

    try {
        await updateIdentityUser(userId, {
            email: email || undefined,
            name: displayName || undefined,
            emailVerified: typeof input.email_confirmed === 'boolean' ? input.email_confirmed : undefined,
        });
    } catch (updateError) {
        return {
            success: false,
            error: updateError instanceof Error ? updateError.message : 'No se pudo actualizar el usuario',
        };
    }

    let passwordResetMethod: 'direct' | null = null;
    if (input.password?.trim()) {
        try {
            const { setIdentityUserPassword } = await import('@/lib/auth/identity');
            await setIdentityUserPassword(userId, input.password);
            passwordResetMethod = 'direct';
        } catch (passwordError) {
            return {
                success: false,
                error:
                    passwordError instanceof Error
                        ? passwordError.message
                        : 'No se pudo restablecer la contraseña',
            };
        }
    }

    try {
        const db = getDb();

        const [profileRow] = await db
            .select({ id: schema.userProfiles.id })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.userId, userId))
            .limit(1);

        if (profileRow) {
            await db
                .update(schema.userProfiles)
                .set({
                    currencyBase: currencyGate.next,
                    payFrequency: profile.pay_frequency,
                    payDates: normalizedPayDates,
                    goalType: profile.goal_type,
                    timezone: profile.timezone,
                    onboardingCompleted: profile.onboarding_completed,
                    updatedAt: new Date(),
                })
                .where(eq(schema.userProfiles.userId, userId));
        } else {
            await db.insert(schema.userProfiles).values({
                userId,
                currencyBase: currencyGate.next || DEFAULT_PROFILE.currency_base,
                payFrequency: profile.pay_frequency || DEFAULT_PROFILE.pay_frequency,
                payDates: normalizedPayDates,
                goalType: profile.goal_type || DEFAULT_PROFILE.goal_type,
                timezone: profile.timezone || DEFAULT_PROFILE.timezone,
                onboardingCompleted: profile.onboarding_completed ?? false,
            });
        }

        const tenantIdForSubscriptionUpdate = await getOrEnsureCurrentTenantIdForUser(userId);
        if (tenantIdForSubscriptionUpdate) {
            const planCode = subscription.plan_code || DEFAULT_SUBSCRIPTION.plan_code;
            const status = subscription.status || DEFAULT_SUBSCRIPTION.status;
            const renewAt = normalizeOptionalDate(subscription.renew_at);
            const cancelAt = normalizeOptionalDate(subscription.cancel_at);

            await db
                .insert(schema.subscriptions)
                .values({
                    tenantId: tenantIdForSubscriptionUpdate,
                    userId,
                    purchaserUserId: userId,
                    planCode,
                    status,
                    provider: normalizedProvider,
                    externalId: subscription.external_id ?? undefined,
                    renewAt,
                    cancelAt,
                })
                .onConflictDoUpdate({
                    target: schema.subscriptions.tenantId,
                    set: {
                        userId,
                        purchaserUserId: userId,
                        planCode,
                        status,
                        provider: normalizedProvider,
                        externalId: subscription.external_id ?? undefined,
                        renewAt,
                        cancelAt,
                        updatedAt: new Date(),
                    },
                });
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'No se pudo actualizar el usuario',
        };
    }

    await logAdminAction(session.adminId, 'UPDATE_USER', 'users', userId, {
        email,
        plan: subscription.plan_code,
        ...(passwordResetMethod ? { password_reset_method: passwordResetMethod } : {}),
    });

    if (passwordResetMethod === 'direct') {
        await logAdminAction(session.adminId, 'RESET_USER_PASSWORD', 'users', userId, {
            method: 'direct',
        });
    }

    return { success: true };
}

// ============================================
// SEND PASSWORD RESET EMAIL (ADMIN)
// ============================================

export async function sendUserPasswordResetEmail(
    userId: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await requirePermission('users:update');

    const { getIdentityUserById, sendIdentityPasswordResetEmail, isIdentityPasswordResetEmailConfigured } =
        await import('@/lib/auth/identity');
    const user = await getIdentityUserById(userId);
    if (!user?.email) {
        return { success: false, error: 'Usuario no encontrado' };
    }

    if (!isIdentityPasswordResetEmailConfigured()) {
        return {
            success: false,
            error: 'El envío de correo no está configurado. Usa el campo de contraseña para asignar una temporal.',
        };
    }

    try {
        await sendIdentityPasswordResetEmail(user.email);
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'No se pudo enviar el correo de restablecimiento',
        };
    }

    await logAdminAction(session.adminId, 'SEND_PASSWORD_RESET_EMAIL', 'users', userId);

    return {
        success: true,
        message: 'Se envió un correo con un código para restablecer la contraseña.',
    };
}

// ============================================
// DELETE USER (ADMIN)
// ============================================

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const session = await requirePermission('users:update');

    try {
        const { deleteIdentityUser } = await import('@/lib/auth/identity');
        await deleteIdentityUser(userId);
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'No se pudo eliminar el usuario',
        };
    }

    await logAdminAction(session.adminId, 'DELETE_USER', 'users', userId);

    return { success: true };
}

// ============================================
// GET ADMIN STATS
// ============================================

export async function getAdminStats(): Promise<{
    totalUsers: number;
    activeToday: number;
    totalDebts: number;
    totalDebtAmount: number;
    openTickets: number;
    recentSignups: number;
}> {
    await requirePermission('users:read');

    const empty = {
        totalUsers: 0,
        activeToday: 0,
        totalDebts: 0,
        totalDebtAmount: 0,
        openTickets: 0,
        recentSignups: 0,
    };

    try {
        const db = getDb();

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [totalUsersRow, recentSignupsRow, debtRows] = await Promise.all([
            db.select({ value: count() }).from(schema.userProfiles),
            db
                .select({ value: count() })
                .from(schema.userProfiles)
                .where(gte(schema.userProfiles.createdAt, weekAgo)),
            db
                .select({ balance: schema.debts.balance })
                .from(schema.debts)
                .where(eq(schema.debts.status, 'ACTIVE')),
        ]);

        let openTickets = 0;
        try {
            const [openTicketsRow] = await db
                .select({ value: count() })
                .from(schema.supportTickets)
                .where(inArray(schema.supportTickets.status, ['OPEN', 'IN_PROGRESS']));
            openTickets = openTicketsRow?.value ?? 0;
        } catch {
            // Support tables may not exist in every environment yet.
        }

        return {
            totalUsers: totalUsersRow[0]?.value ?? 0,
            activeToday: 0, // Would need session tracking
            totalDebts: debtRows.length,
            totalDebtAmount: debtRows.reduce((sum, d) => sum + Number(d.balance), 0),
            openTickets,
            recentSignups: recentSignupsRow[0]?.value ?? 0,
        };
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching admin stats');
        return empty;
    }
}
