'use server';

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
    ADMIN_SESSION_AUDIENCE,
    ADMIN_SESSION_ISSUER,
    verifyAdminSessionToken,
} from '@/lib/security/admin-session';
import { logSecurityEvent, logger } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { getTotpRequirementState, verifyTotpCode } from '@/lib/security/totp';
import {
    checkLoginLockout,
    clearLoginFailures,
    formatRetryTime,
    registerLoginFailure,
} from '@/lib/security/login-lockout';

// ============================================
// TYPES
// ============================================

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'ANALYST';

export interface AdminUser {
    id: string;
    email: string;
    display_name: string | null;
    role: AdminRole;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
}

export interface AdminSession {
    adminId: string;
    email: string;
    role: AdminRole;
    displayName: string | null;
}

// Used to equalize timing when admin user doesn't exist.
const DUMMY_PASSWORD_HASH = '$2b$10$d0xTuk8/RW/2qTbtSsDaqu6ELAL3wMuKRDMF7ErHgr2beFxRa/gzO';

async function getRequestIpFromHeaders() {
    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for');
    const realIp = headerStore.get('x-real-ip');
    return forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

function isAdminPasswordExpired(passwordRotatedAt: string | null | undefined) {
    const maxAgeDays = Number(process.env.ADMIN_PASSWORD_MAX_AGE_DAYS || 0);
    if (!maxAgeDays || !passwordRotatedAt) return false;
    const ageMs = Date.now() - new Date(passwordRotatedAt).getTime();
    return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

// ============================================
// ADMIN LOGIN
// ============================================

export async function adminLogin(email: string, password: string, mfaCode?: string): Promise<{
    success: boolean;
    error?: string;
    admin?: AdminUser;
}> {
    const normalizedEmail = email.trim().toLowerCase();
    const ip = await getRequestIpFromHeaders();

    const accountLimit = await applyRateLimit(`admin-login:account:${normalizedEmail}`, 'login');
    const ipLimit = await applyRateLimit(`admin-login:ip:${ip}`, 'login');

    const lockout = await checkLoginLockout('admin', normalizedEmail);
    if (lockout.blocked) {
        return {
            success: false,
            error: `Cuenta temporalmente bloqueada. Intenta nuevamente en ${formatRetryTime(lockout.retryAfterSeconds)}.`,
        };
    }

    if (!accountLimit.success || !ipLimit.success) {
        logSecurityEvent({
            event: 'rate_limit_exceeded',
            ip,
            path: '/admin/login',
            details: { email: normalizedEmail },
        });
        return { success: false, error: 'Demasiados intentos. Intenta nuevamente en unos minutos.' };
    }

    // Use service-role client because admin tables should not be accessible via anon/authenticated roles.
    const supabase = createAdminClient();

    // Define interface for admin_users (table not in generated types yet)
    interface AdminUserRow {
        id: string;
        email: string;
        password_hash: string;
        display_name: string;
        role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'ANALYST';
        is_active: boolean;
        must_rotate_password: boolean;
        password_rotated_at: string | null;
        last_login_at: string | null;
        created_at: string;
    }

    // Get admin user by email
    // PERF-011: Select specific fields instead of *
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: adminData, error } = await (supabase as any)
        .from('admin_users')
        .select('id, email, password_hash, display_name, role, is_active, must_rotate_password, password_rotated_at, last_login_at, created_at')
        .eq('email', normalizedEmail)
        .eq('is_active', true)
        .single();

    const admin = adminData as AdminUserRow | null;

    if (error || !admin?.password_hash) {
        // Keep response timing closer to valid-user case.
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        const failure = await registerLoginFailure('admin', normalizedEmail, ip);
        logSecurityEvent({
            event: 'suspicious_activity',
            ip,
            path: '/admin/login',
            details: { reason: 'invalid_admin_credentials', email: normalizedEmail },
        });
        if (failure.blocked) {
            return {
                success: false,
                error: `Cuenta temporalmente bloqueada. Intenta nuevamente en ${formatRetryTime(failure.retryAfterSeconds)}.`,
            };
        }
        return { success: false, error: 'Credenciales inválidas' };
    }

    // Verify password (trim hash in case of whitespace in DB)
    const isValidPassword = await bcrypt.compare(password, admin.password_hash.trim());

    if (!isValidPassword) {
        const failure = await registerLoginFailure('admin', normalizedEmail, ip);
        logSecurityEvent({
            event: 'suspicious_activity',
            ip,
            path: '/admin/login',
            details: { reason: 'invalid_admin_password', email: normalizedEmail },
        });
        if (failure.blocked) {
            return {
                success: false,
                error: `Cuenta temporalmente bloqueada. Intenta nuevamente en ${formatRetryTime(failure.retryAfterSeconds)}.`,
            };
        }
        return { success: false, error: 'Credenciales inválidas' };
    }

    const totpRequirementState = getTotpRequirementState();

    if (totpRequirementState === 'misconfigured') {
        logSecurityEvent({
            event: 'admin_mfa_secret_not_configured',
            details: { env: process.env.NODE_ENV },
        });
        logger.error('Admin MFA secret missing in environment');
        return { success: false, error: 'Configuración de MFA incompleta. Contacta a soporte.' };
    }

    if (totpRequirementState === 'enabled' && !verifyTotpCode(mfaCode)) {
        const failure = await registerLoginFailure('admin', normalizedEmail, ip);
        logSecurityEvent({
            event: 'suspicious_activity',
            ip,
            path: '/admin/login',
            details: { reason: 'invalid_admin_mfa', email: normalizedEmail },
        });
        if (failure.blocked) {
            return {
                success: false,
                error: `Cuenta temporalmente bloqueada. Intenta nuevamente en ${formatRetryTime(failure.retryAfterSeconds)}.`,
            };
        }
        return { success: false, error: 'Código MFA inválido' };
    }

    if (admin.must_rotate_password || isAdminPasswordExpired(admin.password_rotated_at)) {
        return {
            success: false,
            error: 'Debes rotar tu contraseña de administrador antes de continuar.',
        };
    }

    await clearLoginFailures('admin', normalizedEmail, ip);

    // Update last login
    await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', admin.id);

    // Get JWT secret (fail-secure)
    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
        logSecurityEvent({
            event: 'admin_jwt_secret_not_configured',
            details: { env: process.env.NODE_ENV },
        });
        return { success: false, error: 'Configuración de seguridad incompleta' };
    }

    // Create JWT token with signed session data (VUL-004 remediation)
    const sessionPayload = {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        displayName: admin.display_name,
    };

    const token = jwt.sign(sessionPayload, jwtSecret, {
        expiresIn: '8h',
        issuer: ADMIN_SESSION_ISSUER,
        audience: ADMIN_SESSION_AUDIENCE,
    });

    const cookieStore = await cookies();

    const isSecure = process.env.NODE_ENV === 'production';

    // Set signed JWT token in cookie
    cookieStore.set('admin_session', token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'strict',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/admin', // Restrict to admin routes only
    });

    // Log action
    await logAdminAction(admin.id, 'LOGIN', 'admin_users', admin.id);

    return { success: true, admin };
}

// ============================================
// ADMIN LOGOUT
// ============================================

export async function adminLogout(): Promise<void> {
    const session = await getAdminSession();

    if (session) {
        await logAdminAction(session.adminId, 'LOGOUT', 'admin_users', session.adminId);
    }

    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
}

// ============================================
// GET ADMIN SESSION
// ============================================

export async function getAdminSession(): Promise<AdminSession | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('admin_session');

    if (!sessionCookie?.value) {
        return null;
    }

    // Get JWT secret
    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
        logSecurityEvent({
            event: 'admin_jwt_secret_not_configured',
            details: { action: 'get_session' },
        });
        return null;
    }

    try {
        const verification = await verifyAdminSessionToken(sessionCookie.value, jwtSecret);
        if (verification.valid && verification.payload) {
            const { adminId, email, role, displayName } = verification.payload;
            return { adminId, email, role, displayName };
        }

        // Log failed verification attempts for security monitoring
        logSecurityEvent({
            event: 'invalid_admin_session_token',
            details: {
                error: verification.reason || 'Unknown error',
            },
        });
        return null;
    } catch (error) {
        logSecurityEvent({
            event: 'invalid_admin_session_token',
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
        });
        return null;
    }
}

// ============================================
// REQUIRE ADMIN AUTH
// ============================================

export async function requireAdminAuth(): Promise<AdminSession> {
    const session = await getAdminSession();

    if (!session) {
        throw new Error('Admin authentication required');
    }

    return session;
}

// ============================================
// RBAC PERMISSIONS
// ============================================

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
    SUPER_ADMIN: ['*'], // All permissions
    ADMIN: [
        'dashboard:read',
        'notifications:read',
        'users:read', 'users:update',
        'tickets:read', 'tickets:update', 'tickets:assign',
        'subscriptions:read', 'subscriptions:update',
        'reports:read',
        'audit:read',
        'settings:read',
    ],
    SUPPORT: [
        'dashboard:read',
        'notifications:read',
        'users:read',
        'tickets:read', 'tickets:update', 'tickets:assign',
    ],
    ANALYST: [
        'dashboard:read',
        'notifications:read',
        'reports:read',
        'users:read',
    ],
};

export async function getPermissionsForRole(role: AdminRole): Promise<string[]> {
    return ROLE_PERMISSIONS[role] || [];
}

export async function roleHasPermission(role: AdminRole, permission: string): Promise<boolean> {
    const permissions = await getPermissionsForRole(role);
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
}

export async function hasPermission(permission: string): Promise<boolean> {
    const session = await getAdminSession();

    if (!session) return false;

    return await roleHasPermission(session.role, permission);
}

export async function requirePermission(permission: string): Promise<AdminSession> {
    const session = await requireAdminAuth();

    const hasAccess = await hasPermission(permission);

    if (!hasAccess) {
        throw new Error(`Permission denied: ${permission}`);
    }

    return session;
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logAdminAction(
    adminId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>
): Promise<void> {
    const supabase = createAdminClient();
    const auditDetails = details ?? {};

    // INFO-012: Handle audit log errors gracefully
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: auditError } = await (supabase as any).from('audit_logs').insert({
        admin_id: adminId,
        admin_user_id: adminId,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        // Keep both shapes populated while local environments still carry the legacy column set.
        details: details || null,
        metadata: auditDetails,
    });

    // Don't fail the main operation, but log the error
    if (auditError) {
        logger.error({
            operation: action,
            adminId,
            entityType,
            entityId,
            error: auditError.message,
            code: auditError.code,
        }, 'Failed to create audit log');

        // Also log as security event for monitoring
        logSecurityEvent({
            event: 'audit_log_failed',
            userId: adminId,
            details: {
                action,
                entityType,
                error: auditError.message,
            },
        });
    }
}

// ============================================
// CHANGE PASSWORD
// ============================================

export async function changeAdminPassword(
    currentPassword: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    const session = await requireAdminAuth();
    const supabase = createAdminClient();

    // Get current admin
    const { data: admin } = await supabase
        .from('admin_users')
        .select('password_hash')
        .eq('id', session.adminId)
        .single();

    if (!admin) {
        return { success: false, error: 'Admin not found' };
    }

    if (!admin.password_hash) {
        // Admin account exists but doesn't have a password-based login configured.
        return { success: false, error: 'Este admin no tiene contraseña configurada' };
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isValid) {
        return { success: false, error: 'Contraseña actual incorrecta' };
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error } = await supabase
        .from('admin_users')
        .update({
            password_hash: newHash,
            password_rotated_at: new Date().toISOString(),
            must_rotate_password: false,
        })
        .eq('id', session.adminId);

    if (error) {
        return { success: false, error: 'Error al actualizar contraseña' };
    }

    await logAdminAction(session.adminId, 'PASSWORD_CHANGE', 'admin_users', session.adminId);

    return { success: true };
}
