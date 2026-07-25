'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requirePermission, logAdminAction } from './admin-auth';
import { ensureCurrentTenantForUser } from '@/lib/tenant/server';
import { getDisplayName } from '@/lib/auth/display-name';

async function getOrEnsureCurrentTenantIdForUser(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
    const { data: profile } = await adminClient
        .from('user_profiles')
        .select('current_tenant_id')
        .eq('user_id', userId)
        .maybeSingle();

    const tenantId = (profile?.current_tenant_id as string | null | undefined) || null;
    if (tenantId) return tenantId;

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
    return parsed.toISOString();
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

    const adminClient = createAdminClient();

    const page = options?.page || 1;
    const perPage = options?.limit || 20;

    const { listIdentityUsers } = await import('@/lib/auth/identity');
    const authResponse = await listIdentityUsers({
        page,
        perPage,
        search: options?.search,
    });

    if (!authResponse.users.length && authResponse.total === 0) {
        return { users: [], total: 0 };
    }

    // Get user profiles for onboarding status (using admin client to bypass RLS)
    const userIds = authResponse.users.map(u => u.id);
    const { data: profiles } = await adminClient
        .from('user_profiles')
        .select('user_id, onboarding_completed, current_tenant_id')
        .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Get subscriptions for users
    const tenantIds = Array.from(
        new Set(
            (profiles || [])
                .map((p) => (p as { current_tenant_id?: string | null }).current_tenant_id)
                .filter((id): id is string => !!id)
        )
    );
    const { data: subscriptions } = await adminClient
        .from('subscriptions')
        .select('tenant_id, plan_code, status')
        .in('tenant_id', tenantIds.length ? tenantIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('status', 'ACTIVE');

    const subscriptionMap = new Map(subscriptions?.map(s => [s.tenant_id, s.plan_code]) || []);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Enrich with debt data — ONE batched query for the whole page instead
    // of a query per user (audit 2026-07, perf P1: N+1). Same pattern as the
    // subscriptions batch above. `userIds` was already built for profiles.
    const { data: allDebts } = await adminClient
        .from('debts')
        .select('user_id, balance')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('status', 'ACTIVE');

    const debtsByUser = new Map<string, { count: number; total: number }>();
    for (const debt of allDebts ?? []) {
        const entry = debtsByUser.get(debt.user_id) ?? { count: 0, total: 0 };
        entry.count += 1;
        entry.total += Number(debt.balance) || 0;
        debtsByUser.set(debt.user_id, entry);
    }

    const users: UserListItem[] = authResponse.users.map((authUser) => {
            const debtEntry = debtsByUser.get(authUser.id);
            const debtCount = debtEntry?.count || 0;
            const totalDebt = debtEntry?.total || 0;

            const displayName =
                authUser.name ||
                (authUser.raw
                    ? getDisplayName(authUser.raw as Parameters<typeof getDisplayName>[0])
                    : null);

            const profile = profileMap.get(authUser.id) as { onboarding_completed?: boolean; current_tenant_id?: string | null } | undefined;
            const lastSignIn = authUser.lastSignInAt ? new Date(authUser.lastSignInAt) : null;
            const isActive = lastSignIn ? lastSignIn >= thirtyDaysAgo : false;

            return {
                id: authUser.id,
                email: authUser.email || '',
                display_name: displayName,
                created_at: authUser.createdAt,
                last_sign_in_at: authUser.lastSignInAt,
                debt_count: debtCount,
                total_debt: totalDebt,
                subscription_plan: profile?.current_tenant_id ? (subscriptionMap.get(profile.current_tenant_id) || 'FREE') : 'FREE',
                banned_until: authUser.bannedUntil,
                email_confirmed: authUser.emailVerified,
                onboarding_completed: profile?.onboarding_completed || false,
                is_active: isActive,
            };
        });

    return { users, total: authResponse.total };
}

// ============================================
// GET USER DETAILS
// ============================================

export async function getUserDetails(userId: string): Promise<UserDetails | null> {
    const session = await requirePermission('users:read');

    const adminClient = createAdminClient();

    const { getIdentityUserById } = await import('@/lib/auth/identity');
    const identityUser = await getIdentityUserById(userId);

    if (!identityUser) {
        console.error('Error fetching user:', userId);
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

    // Get debts
    const { data: debts } = await adminClient
        .from('debts')
        .select('id, creditor, balance, type')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE');

    // Get payments count
    const { count: paymentsCount } = await adminClient
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    // Check for active plan
    const { data: activePlan } = await adminClient
        .from('plans')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();

    const debtTotal = debts?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;

    // Get name from user metadata if available
    const displayName = getDisplayName(authUser);

    // Get user profile for onboarding status
    const { data: profile } = await adminClient
        .from('user_profiles')
        .select('currency_base, pay_frequency, pay_dates, goal_type, timezone, onboarding_completed, current_tenant_id')
        .eq('user_id', userId)
        .maybeSingle();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const lastSignIn = authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null;
    const isActive = lastSignIn ? lastSignIn >= thirtyDaysAgo : false;

    // Get subscription plan
    let subscription: UserSubscriptionData | null = null;

    const tenantIdForSubscription = (profile as { current_tenant_id?: string | null } | null)?.current_tenant_id
        ?? await getOrEnsureCurrentTenantIdForUser(adminClient, userId);

    if (tenantIdForSubscription) {
        const { data } = await adminClient
            .from('subscriptions')
            .select('plan_code, status, provider, external_id, renew_at, cancel_at')
            .eq('tenant_id', tenantIdForSubscription)
            .maybeSingle();
        if (data) {
            subscription = {
                plan_code: data.plan_code,
                status: data.status,
                provider: data.provider ?? null,
                external_id: data.external_id ?? null,
                renew_at: data.renew_at ?? null,
                cancel_at: data.cancel_at ?? null,
            };
        }
    }

    return {
        id: userId,
        email: authUser.email || '',
        display_name: displayName,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        debt_count: debts?.length || 0,
        total_debt: debtTotal,
        subscription_plan: subscription?.plan_code || 'FREE',
        banned_until: bannedUntil,
        email_confirmed: !!authUser.email_confirmed_at,
        onboarding_completed: profile?.onboarding_completed || false,
        is_active: isActive,
        profile: profile
            ? {
                currency_base: profile.currency_base,
                pay_frequency: profile.pay_frequency,
                pay_dates: profile.pay_dates,
                goal_type: profile.goal_type,
                timezone: profile.timezone,
                onboarding_completed: profile.onboarding_completed,
            }
            : null,
        subscription,
        debts: debts || [],
        payments_count: paymentsCount || 0,
        plan_active: !!activePlan,
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
    const adminClient = createAdminClient();

    if (!ALLOWED_BAN_DURATIONS.has(duration)) {
        return { success: false, error: 'Duración de bloqueo inválida' };
    }

    try {
        const { setIdentityUserBan } = await import('@/lib/auth/identity');
        const { bannedUntil } = await setIdentityUserBan(userId, duration);

        await logAdminAction(
            session.adminId,
            duration === 'none' ? 'UNBAN_USER' : 'BAN_USER',
            'auth.users',
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
    const adminClient = createAdminClient();

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

    const { error: profileError } = await adminClient
        .from('user_profiles')
        .insert({
            user_id: userId,
            currency_base: profile.currency_base || DEFAULT_PROFILE.currency_base,
            pay_frequency: profile.pay_frequency || DEFAULT_PROFILE.pay_frequency,
            pay_dates: normalizedPayDates,
            goal_type: profile.goal_type || DEFAULT_PROFILE.goal_type,
            timezone: profile.timezone || DEFAULT_PROFILE.timezone,
            onboarding_completed: profile.onboarding_completed ?? false,
        });

    if (profileError) {
        return { success: false, error: profileError.message };
    }

    const { error: subscriptionError } = await adminClient
        .from('subscriptions')
        .update({
            plan_code: subscription.plan_code || DEFAULT_SUBSCRIPTION.plan_code,
            status: subscription.status || DEFAULT_SUBSCRIPTION.status,
            provider: normalizedProvider,
            external_id: subscription.external_id ?? undefined,
            renew_at: normalizeOptionalDate(subscription.renew_at),
            cancel_at: normalizeOptionalDate(subscription.cancel_at),
            purchaser_user_id: userId,
            user_id: userId,
        })
        .eq('tenant_id', await ensureCurrentTenantForUser(userId));

    if (subscriptionError) {
        return { success: false, error: subscriptionError.message };
    }

    await logAdminAction(session.adminId, 'CREATE_USER', 'auth.users', userId, {
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
    const adminClient = createAdminClient();

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

    try {
        await updateIdentityUser(userId, {
            email: email || undefined,
            name: displayName || undefined,
            emailVerified: typeof input.email_confirmed === 'boolean' ? input.email_confirmed : undefined,
        });

        // Password updates on better-auth path are not supported via this
        // admin form yet (requires better-auth admin plugin). Supabase path
        // still handles password via updateIdentityUser's underlying API when
        // we extend it; for now keep Supabase-only password updates.
        if (input.password && !(await import('@/lib/auth/provider')).isBetterAuthEnabled()) {
            const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, {
                password: input.password,
            });
            if (passwordError) {
                return { success: false, error: passwordError.message };
            }
        }
    } catch (updateError) {
        return {
            success: false,
            error: updateError instanceof Error ? updateError.message : 'No se pudo actualizar el usuario',
        };
    }

    const { data: profileRow } = await adminClient
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

    if (profileRow) {
        const { error: profileError } = await adminClient
            .from('user_profiles')
            .update({
                currency_base: profile.currency_base,
                pay_frequency: profile.pay_frequency,
                pay_dates: normalizedPayDates,
                goal_type: profile.goal_type,
                timezone: profile.timezone,
                onboarding_completed: profile.onboarding_completed,
            })
            .eq('user_id', userId);

        if (profileError) {
            return { success: false, error: profileError.message };
        }
    } else {
        const { error: profileError } = await adminClient
            .from('user_profiles')
            .insert({
                user_id: userId,
                currency_base: profile.currency_base || DEFAULT_PROFILE.currency_base,
                pay_frequency: profile.pay_frequency || DEFAULT_PROFILE.pay_frequency,
                pay_dates: normalizedPayDates,
                goal_type: profile.goal_type || DEFAULT_PROFILE.goal_type,
                timezone: profile.timezone || DEFAULT_PROFILE.timezone,
                onboarding_completed: profile.onboarding_completed ?? false,
            });

        if (profileError) {
            return { success: false, error: profileError.message };
        }
    }

    const tenantIdForSubscriptionUpdate = await getOrEnsureCurrentTenantIdForUser(adminClient, userId);
    if (tenantIdForSubscriptionUpdate) {
        const { error: subscriptionError } = await adminClient
            .from('subscriptions')
            .upsert(
                {
                    tenant_id: tenantIdForSubscriptionUpdate,
                    user_id: userId,
                    purchaser_user_id: userId,
                    plan_code: subscription.plan_code || DEFAULT_SUBSCRIPTION.plan_code,
                    status: subscription.status || DEFAULT_SUBSCRIPTION.status,
                    provider: normalizedProvider,
                    external_id: subscription.external_id ?? undefined,
                    renew_at: normalizeOptionalDate(subscription.renew_at),
                    cancel_at: normalizeOptionalDate(subscription.cancel_at),
                },
                { onConflict: 'tenant_id' }
            );

        if (subscriptionError) {
            return { success: false, error: subscriptionError.message };
        }
    }

    await logAdminAction(session.adminId, 'UPDATE_USER', 'auth.users', userId, {
        email,
        plan: subscription.plan_code,
    });

    return { success: true };
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

    await logAdminAction(session.adminId, 'DELETE_USER', 'auth.users', userId);

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
    const supabase = await createClient();

    // Total users
    const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

    // Recent signups (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: recentSignups } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());

    // Total debts
    const { count: totalDebts } = await supabase
        .from('debts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE');

    // Total debt amount
    const { data: debtSums } = await supabase
        .from('debts')
        .select('balance')
        .eq('status', 'ACTIVE');
    const totalDebtAmount = debtSums?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;

    // Open tickets (when table exists)
    let openTickets = 0;
    try {
        const { count } = await supabase
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .in('status', ['OPEN', 'IN_PROGRESS']);
        openTickets = count || 0;
    } catch {
        // Table might not exist yet
    }

    return {
        totalUsers: totalUsers || 0,
        activeToday: 0, // Would need session tracking
        totalDebts: totalDebts || 0,
        totalDebtAmount,
        openTickets,
        recentSignups: recentSignups || 0,
    };
}
