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

    // Use admin API to list users from auth.users
    const { data: authResponse, error: authError } = await adminClient.auth.admin.listUsers({
        page: page,
        perPage: perPage,
    });

    if (authError || !authResponse?.users) {
        console.error('Error fetching users:', authError);
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

    // Enrich with debt data for each user
    const users: UserListItem[] = await Promise.all(
        authResponse.users.map(async (authUser) => {
            const bannedUntil = (authUser as { banned_until?: string | null }).banned_until ?? null;
            const { data: debts } = await adminClient
                .from('debts')
                .select('balance')
                .eq('user_id', authUser.id)
                .eq('status', 'ACTIVE');

            const debtCount = debts?.length || 0;
            const totalDebt = debts?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;

            // Get name from user metadata if available
            const displayName = getDisplayName(authUser);

            // Check status fields
            const profile = profileMap.get(authUser.id) as { onboarding_completed?: boolean; current_tenant_id?: string | null } | undefined;
            const lastSignIn = authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null;
            const isActive = lastSignIn ? lastSignIn >= thirtyDaysAgo : false;

            return {
                id: authUser.id,
                email: authUser.email || '',
                display_name: displayName,
                created_at: authUser.created_at,
                last_sign_in_at: authUser.last_sign_in_at || null,
                debt_count: debtCount,
                total_debt: totalDebt,
                subscription_plan: profile?.current_tenant_id ? (subscriptionMap.get(profile.current_tenant_id) || 'FREE') : 'FREE',
                banned_until: bannedUntil,
                email_confirmed: !!authUser.email_confirmed_at,
                onboarding_completed: profile?.onboarding_completed || false,
                is_active: isActive,
            };
        })
    );

    // Filter by search if provided
    let filteredUsers = users;
    if (options?.search) {
        const searchLower = options.search.toLowerCase();
        filteredUsers = users.filter(u =>
            u.email.toLowerCase().includes(searchLower) ||
            u.display_name?.toLowerCase().includes(searchLower)
        );
    }

    return { users: filteredUsers, total: authResponse.users.length };
}

// ============================================
// GET USER DETAILS
// ============================================

export async function getUserDetails(userId: string): Promise<UserDetails | null> {
    const session = await requirePermission('users:read');

    const adminClient = createAdminClient();

    // Get user from auth.users
    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(userId);

    if (authError || !authData?.user) {
        console.error('Error fetching user:', authError);
        return null;
    }

    const authUser = authData.user;
    const bannedUntil = (authUser as { banned_until?: string | null }).banned_until ?? null;

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

    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: duration as 'none' | '24h' | '72h' | '168h' | '720h' | '8760h',
    });

    if (error) {
        return { success: false, error: error.message };
    }

    await logAdminAction(
        session.adminId,
        duration === 'none' ? 'UNBAN_USER' : 'BAN_USER',
        'auth.users',
        userId,
        { ban_duration: duration }
    );

    const bannedUntil = (data.user as { banned_until?: string | null }).banned_until ?? null;
    return { success: true, banned_until: bannedUntil };
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

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: input.email_confirmed ?? false,
        user_metadata: displayName ? { full_name: displayName, name: displayName } : {},
    });

    if (createError || !createData?.user) {
        return { success: false, error: createError?.message || 'No se pudo crear el usuario' };
    }

    const userId = createData.user.id;

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

    const { data: existingUser, error: existingError } = await adminClient.auth.admin.getUserById(userId);
    if (existingError || !existingUser?.user) {
        return { success: false, error: existingError?.message || 'Usuario no encontrado' };
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

    const existingMetadata = (existingUser.user.user_metadata || {}) as Record<string, unknown>;
    const updatedMetadata = {
        ...existingMetadata,
        full_name: displayName || null,
        name: displayName || null,
    };

    const updatePayload: {
        email?: string;
        password?: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, unknown>;
    } = {};

    if (email) updatePayload.email = email;
    if (input.password) updatePayload.password = input.password;
    if (typeof input.email_confirmed === 'boolean') {
        updatePayload.email_confirm = input.email_confirmed;
    }
    updatePayload.user_metadata = updatedMetadata;

    if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
        if (updateError) {
            return { success: false, error: updateError.message };
        }
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
    const adminClient = createAdminClient();

    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
        return { success: false, error: error.message };
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
