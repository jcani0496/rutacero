'use server';

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, schema } from '@/db/client';
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

    const db = getDb();
    const [adminRow] = await db
        .select({
            id: schema.adminUsers.id,
            email: schema.adminUsers.email,
            passwordHash: schema.adminUsers.passwordHash,
            displayName: schema.adminUsers.displayName,
            role: schema.adminUsers.role,
            isActive: schema.adminUsers.isActive,
            mustRotatePassword: schema.adminUsers.mustRotatePassword,
            passwordRotatedAt: schema.adminUsers.passwordRotatedAt,
            lastLoginAt: schema.adminUsers.lastLoginAt,
            createdAt: schema.adminUsers.createdAt,
            mfaEnabled: schema.adminUsers.mfaEnabled,
        })
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.email, normalizedEmail))
        .limit(1);

    const admin = adminRow?.isActive
        ? {
              id: adminRow.id,
              email: adminRow.email,
              password_hash: adminRow.passwordHash,
              display_name: adminRow.displayName,
              role: adminRow.role as AdminRole,
              is_active: adminRow.isActive,
              must_rotate_password: adminRow.mustRotatePassword,
              password_rotated_at: adminRow.passwordRotatedAt?.toISOString() ?? null,
              last_login_at: adminRow.lastLoginAt?.toISOString() ?? null,
              created_at: adminRow.createdAt.toISOString(),
              mfa_enabled: adminRow.mfaEnabled,
          }
        : null;

    if (!admin?.password_hash) {
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

    // MFA is opt-in per admin. Skip until the admin enables it (mfa_enabled).
    if (admin.mfa_enabled) {
        const totpRequirementState = getTotpRequirementState();

        if (totpRequirementState !== 'enabled') {
            logSecurityEvent({
                event: 'admin_mfa_secret_not_configured',
                details: { env: process.env.NODE_ENV, adminId: admin.id },
            });
            logger.error('Admin MFA enabled on user but ADMIN_MFA_TOTP_SECRET missing');
            return {
                success: false,
                error: 'Configuración de MFA incompleta. Contacta a soporte.',
            };
        }

        if (!verifyTotpCode(mfaCode)) {
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
    }

    if (admin.must_rotate_password || isAdminPasswordExpired(admin.password_rotated_at)) {
        return {
            success: false,
            error: 'Debes rotar tu contraseña de administrador antes de continuar.',
        };
    }

    await clearLoginFailures('admin', normalizedEmail, ip);

    // Update last login
    await db
        .update(schema.adminUsers)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.adminUsers.id, admin.id));

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

    try {
        await setAdminSessionCookie(sessionPayload);
    } catch {
        return { success: false, error: 'Configuración de seguridad incompleta' };
    }

    // Log action
    await logAdminAction(admin.id, 'LOGIN', 'admin_users', admin.id);

    return {
        success: true,
        admin: {
            id: admin.id,
            email: admin.email,
            display_name: admin.display_name,
            role: admin.role,
            is_active: admin.is_active,
            last_login_at: admin.last_login_at,
            created_at: admin.created_at,
        },
    };
}

async function setAdminSessionCookie(payload: {
    adminId: string;
    email: string;
    role: AdminRole;
    displayName: string | null;
}): Promise<void> {
    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('ADMIN_JWT_SECRET not configured');
    }

    const token = jwt.sign(payload, jwtSecret, {
        expiresIn: '8h',
        issuer: ADMIN_SESSION_ISSUER,
        audience: ADMIN_SESSION_AUDIENCE,
    });

    const cookieStore = await cookies();
    const isSecure = process.env.NODE_ENV === 'production';

    cookieStore.set('admin_session', token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'strict',
        maxAge: 60 * 60 * 8,
        path: '/admin',
    });
}

export async function refreshAdminSession(session: AdminSession): Promise<void> {
    await setAdminSessionCookie(session);
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

/**
 * Opt-in MFA for the current admin. Enabling requires a valid TOTP code
 * against ADMIN_MFA_TOTP_SECRET so the authenticator is proven before lock-in.
 */
export async function setAdminMfaEnabled(
    enabled: boolean,
    mfaCode?: string,
): Promise<{ success: boolean; error?: string; mfaEnabled?: boolean }> {
    const session = await getAdminSession();
    if (!session) {
        return { success: false, error: 'No autenticado' };
    }

    if (enabled) {
        const totpState = getTotpRequirementState();
        if (totpState !== 'enabled') {
            return {
                success: false,
                error: 'Falta ADMIN_MFA_TOTP_SECRET en el servidor. No se puede activar MFA.',
            };
        }
        if (!verifyTotpCode(mfaCode)) {
            return { success: false, error: 'Código MFA inválido. Escaneá el secreto en tu app e intentá de nuevo.' };
        }
    }

    const db = getDb();
    await db
        .update(schema.adminUsers)
        .set({ mfaEnabled: enabled, updatedAt: new Date() })
        .where(eq(schema.adminUsers.id, session.adminId));

    await logAdminAction(
        session.adminId,
        enabled ? 'ENABLE_ADMIN_MFA' : 'DISABLE_ADMIN_MFA',
        'admin_users',
        session.adminId,
    );

    return { success: true, mfaEnabled: enabled };
}

export async function getAdminMfaStatus(): Promise<{
    mfaEnabled: boolean;
    secretConfigured: boolean;
} | null> {
    const session = await getAdminSession();
    if (!session) return null;

    const db = getDb();
    const [row] = await db
        .select({ mfaEnabled: schema.adminUsers.mfaEnabled })
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.id, session.adminId))
        .limit(1);

    return {
        mfaEnabled: row?.mfaEnabled ?? false,
        secretConfigured: getTotpRequirementState() === 'enabled',
    };
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
    const auditDetails = details ?? {};

    try {
        const db = getDb();
        await db.insert(schema.auditLogs).values({
            adminUserId: adminId,
            action,
            entityType,
            entityId: entityId || 'unknown',
            metadata: auditDetails,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({
            operation: action,
            adminId,
            entityType,
            entityId,
            error: message,
        }, 'Failed to create audit log');

        logSecurityEvent({
            event: 'audit_log_failed',
            userId: adminId,
            details: {
                action,
                entityType,
                error: message,
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
    const db = getDb();

    const [admin] = await db
        .select({ passwordHash: schema.adminUsers.passwordHash })
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.id, session.adminId))
        .limit(1);

    if (!admin) {
        return { success: false, error: 'Admin not found' };
    }

    if (!admin.passwordHash) {
        return { success: false, error: 'Este admin no tiene contraseña configurada' };
    }

    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) {
        return { success: false, error: 'Contraseña actual incorrecta' };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    try {
        await db
            .update(schema.adminUsers)
            .set({
                passwordHash: newHash,
                passwordRotatedAt: new Date(),
                mustRotatePassword: false,
                updatedAt: new Date(),
            })
            .where(eq(schema.adminUsers.id, session.adminId));
    } catch {
        return { success: false, error: 'Error al actualizar contraseña' };
    }

    await logAdminAction(session.adminId, 'PASSWORD_CHANGE', 'admin_users', session.adminId);

    return { success: true };
}
