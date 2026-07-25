import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

const ATTRIBUTION_COOKIE_NAME = 'rutacero-attribution';
const ADMIN_SESSION_ISSUER = 'rutacero-admin';
const ADMIN_SESSION_AUDIENCE = 'rutacero-admin-panel';
const MAX_TRACKING_VALUE_LENGTH = 120;

type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'ANALYST';

interface AdminSessionClaims {
    adminId: string;
    email: string;
    role: AdminRole;
    displayName: string | null;
    exp?: number;
    iss?: string;
    aud?: string | string[];
}

interface AttributionSnapshot {
    source: string | null;
    medium: string | null;
    campaignId: string | null;
    campaignName: string | null;
    creativeId: string | null;
    creativeName: string | null;
    partnerSlug: string | null;
    referralCode: string | null;
    landingVariant: string | null;
    offerVariant: string | null;
    ctaContext: string | null;
    path: string | null;
    capturedAt: string;
}

interface AttributionState {
    attributionId: string;
    firstTouch: AttributionSnapshot | null;
    lastTouch: AttributionSnapshot | null;
    updatedAt: string;
}

interface TrackingOverrides {
    source?: string | null;
    medium?: string | null;
    campaignId?: string | null;
    campaignName?: string | null;
    creativeId?: string | null;
    creativeName?: string | null;
    partnerSlug?: string | null;
    referralCode?: string | null;
    landingVariant?: string | null;
    offerVariant?: string | null;
    ctaContext?: string | null;
    path?: string | null;
}

interface VerificationResult {
    valid: boolean;
    payload?: AdminSessionClaims;
    reason?: string;
}

function sanitizeTrackingValue(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, MAX_TRACKING_VALUE_LENGTH);
}

function inferPartnerSlugFromPath(pathname: string): string | null {
    const match = pathname.match(/^\/partners\/([^/?#]+)/);
    return sanitizeTrackingValue(match?.[1] || null);
}

function inferCtaContextFromPath(pathname: string | null | undefined): string | null {
    if (!pathname) return null;
    if (pathname === '/' || pathname === '') return 'landing';
    if (pathname.startsWith('/pricing')) return 'pricing';
    if (pathname.startsWith('/plan')) return 'plan';
    if (pathname.startsWith('/checkout')) return 'checkout';
    if (pathname.startsWith('/signup')) return 'signup';
    if (pathname.startsWith('/payments')) return 'support_recovery_path';
    return null;
}

function sanitizeSnapshot(value: Partial<AttributionSnapshot>): AttributionSnapshot {
    return {
        source: sanitizeTrackingValue(value.source),
        medium: sanitizeTrackingValue(value.medium),
        campaignId: sanitizeTrackingValue(value.campaignId),
        campaignName: sanitizeTrackingValue(value.campaignName),
        creativeId: sanitizeTrackingValue(value.creativeId),
        creativeName: sanitizeTrackingValue(value.creativeName),
        partnerSlug: sanitizeTrackingValue(value.partnerSlug),
        referralCode: sanitizeTrackingValue(value.referralCode),
        landingVariant: sanitizeTrackingValue(value.landingVariant),
        offerVariant: sanitizeTrackingValue(value.offerVariant),
        ctaContext: sanitizeTrackingValue(value.ctaContext),
        path: sanitizeTrackingValue(value.path),
        capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : new Date().toISOString(),
    };
}

function snapshotHasMeaningfulFields(snapshot: AttributionSnapshot | null): boolean {
    if (!snapshot) return false;

    return Boolean(
        snapshot.source ||
            snapshot.medium ||
            snapshot.campaignId ||
            snapshot.campaignName ||
            snapshot.creativeId ||
            snapshot.creativeName ||
            snapshot.partnerSlug ||
            snapshot.referralCode ||
            snapshot.landingVariant ||
            snapshot.offerVariant ||
            snapshot.ctaContext
    );
}

function parseAttributionCookie(rawValue: string | null | undefined): AttributionState | null {
    if (!rawValue) return null;

    try {
        const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<AttributionState> | null;
        if (!parsed?.attributionId) return null;

        return {
            attributionId: String(parsed.attributionId),
            firstTouch: parsed.firstTouch ? sanitizeSnapshot(parsed.firstTouch) : null,
            lastTouch: parsed.lastTouch ? sanitizeSnapshot(parsed.lastTouch) : null,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function encodeAttributionCookie(state: AttributionState): string {
    return encodeURIComponent(JSON.stringify(state));
}

function extractTrackingOverrides(searchParams: URLSearchParams, pathname: string): TrackingOverrides {
    return {
        source: sanitizeTrackingValue(searchParams.get('utm_source') || searchParams.get('source')),
        medium: sanitizeTrackingValue(searchParams.get('utm_medium') || searchParams.get('medium')),
        campaignId: sanitizeTrackingValue(searchParams.get('campaign_id')),
        campaignName: sanitizeTrackingValue(
            searchParams.get('utm_campaign') || searchParams.get('campaign_name')
        ),
        creativeId: sanitizeTrackingValue(searchParams.get('creative_id')),
        creativeName: sanitizeTrackingValue(
            searchParams.get('creative_name') || searchParams.get('utm_content')
        ),
        partnerSlug:
            sanitizeTrackingValue(searchParams.get('partner_slug') || searchParams.get('partner')) ||
            inferPartnerSlugFromPath(pathname),
        referralCode: sanitizeTrackingValue(searchParams.get('referral_code') || searchParams.get('ref')),
        landingVariant: sanitizeTrackingValue(searchParams.get('landing_variant')),
        offerVariant: sanitizeTrackingValue(searchParams.get('offer_variant')),
        ctaContext: sanitizeTrackingValue(searchParams.get('cta_context')) || inferCtaContextFromPath(pathname),
        path: sanitizeTrackingValue(pathname),
    };
}

function mergeAttributionState(
    existing: AttributionState | null,
    overrides: TrackingOverrides,
    attributionIdFactory: () => string
): AttributionState {
    const nextSnapshot = sanitizeSnapshot({
        ...overrides,
        capturedAt: new Date().toISOString(),
    });

    const existingFirst = existing?.firstTouch ?? null;
    const nextFirstTouch =
        existingFirst || (snapshotHasMeaningfulFields(nextSnapshot) ? nextSnapshot : null);

    const nextLastTouch = snapshotHasMeaningfulFields(nextSnapshot)
        ? nextSnapshot
        : existing?.lastTouch ?? null;

    return {
        attributionId: existing?.attributionId || attributionIdFactory(),
        firstTouch: nextFirstTouch,
        lastTouch: nextLastTouch,
        updatedAt: new Date().toISOString(),
    };
}

function normalizeBase64Url(input: string) {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    return pad === 0 ? base64 : `${base64}${'='.repeat(4 - pad)}`;
}

function decodeBase64UrlToBytes(input: string): Uint8Array {
    const normalized = normalizeBase64Url(input);
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeBase64UrlToString(input: string): string {
    return new TextDecoder().decode(decodeBase64UrlToBytes(input));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

function parseJsonPart<T>(input: string): T | null {
    try {
        return JSON.parse(decodeBase64UrlToString(input)) as T;
    } catch {
        return null;
    }
}

function isValidAudience(aud: string | string[] | undefined) {
    if (!aud) return false;
    return Array.isArray(aud)
        ? aud.includes(ADMIN_SESSION_AUDIENCE)
        : aud === ADMIN_SESSION_AUDIENCE;
}

function isValidPayload(payload: AdminSessionClaims): payload is AdminSessionClaims {
    return Boolean(
        payload &&
            typeof payload.adminId === 'string' &&
            typeof payload.email === 'string' &&
            typeof payload.role === 'string'
    );
}

async function verifyAdminSessionSignature(token: string, secret: string, signaturePart: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const signature = decodeBase64UrlToBytes(signaturePart);
    const signedContent = token.split('.').slice(0, 2).join('.');

    return crypto.subtle.verify(
        'HMAC',
        key,
        toArrayBuffer(signature),
        toArrayBuffer(encoder.encode(signedContent))
    );
}

async function verifyAdminSessionToken(
    token: string | null | undefined,
    secret: string | null | undefined
): Promise<VerificationResult> {
    if (!token) return { valid: false, reason: 'missing_token' };
    if (!secret) return { valid: false, reason: 'missing_secret' };

    const parts = token.split('.');
    if (parts.length !== 3) {
        return { valid: false, reason: 'invalid_token_format' };
    }

    const [headerPart, payloadPart, signaturePart] = parts;
    const header = parseJsonPart<{ alg?: string }>(headerPart);
    const payload = parseJsonPart<AdminSessionClaims>(payloadPart);

    if (!header || header.alg !== 'HS256') {
        return { valid: false, reason: 'invalid_header' };
    }

    if (!payload || !isValidPayload(payload)) {
        return { valid: false, reason: 'invalid_payload' };
    }

    if (payload.iss !== ADMIN_SESSION_ISSUER || !isValidAudience(payload.aud)) {
        return { valid: false, reason: 'invalid_claims' };
    }

    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
        return { valid: false, reason: 'expired_token' };
    }

    const signatureValid = await verifyAdminSessionSignature(token, secret, signaturePart);
    if (!signatureValid) {
        return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true, payload };
}

type SessionGateOptions = {
    /** Extra request headers to forward into NextResponse.next (e.g. CSP nonce). */
    requestHeaders?: Headers;
};

function routeFlags(pathname: string) {
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');
    const isAppRoute =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/debts') ||
        pathname.startsWith('/plan') ||
        pathname.startsWith('/forecast') ||
        pathname.startsWith('/finances') ||
        pathname.startsWith('/payments') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/profile') ||
        pathname.startsWith('/help') ||
        pathname.startsWith('/workspaces');
    const isAdminLoginRoute = pathname === '/admin/login';
    const isAdminRoute = pathname.startsWith('/admin') && !isAdminLoginRoute;
    return { isAuthRoute, isAppRoute, isAdminLoginRoute, isAdminRoute };
}

function applyAttribution(request: NextRequest, response: NextResponse) {
    const attributionState = mergeAttributionState(
        parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value),
        extractTrackingOverrides(request.nextUrl.searchParams, request.nextUrl.pathname),
        () => crypto.randomUUID()
    );
    const encodedAttribution = encodeAttributionCookie(attributionState);
    request.cookies.set(ATTRIBUTION_COOKIE_NAME, encodedAttribution);
    response.cookies.set(ATTRIBUTION_COOKIE_NAME, encodedAttribution, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
    });
    return encodedAttribution;
}

async function applyAdminGates(request: NextRequest) {
    const { isAdminLoginRoute, isAdminRoute } = routeFlags(request.nextUrl.pathname);
    const adminSessionCookie = request.cookies.get('admin_session');
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
    const adminSessionVerification = await verifyAdminSessionToken(
        adminSessionCookie?.value,
        adminJwtSecret
    );

    if (isAdminRoute && !adminSessionVerification.valid) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/login';
        const response = NextResponse.redirect(url);
        response.cookies.delete('admin_session');
        return response;
    }

    if (isAdminLoginRoute && adminSessionVerification.valid) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/dashboard';
        return NextResponse.redirect(url);
    }

    return null;
}

function nextWithHeaders(request: NextRequest, requestHeaders?: Headers) {
    if (!requestHeaders) {
        return NextResponse.next({ request });
    }
    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

/**
 * Session gate + attribution + admin JWT (F6: better-auth only).
 * Wired from `src/proxy.ts`. Cookie existence check only (no DB on the edge).
 */
export async function updateSession(
    request: NextRequest,
    options: SessionGateOptions = {}
) {
    try {
        const adminRedirect = await applyAdminGates(request);
        if (adminRedirect) return adminRedirect;

        const { isAuthRoute, isAppRoute } = routeFlags(request.nextUrl.pathname);

        const response = nextWithHeaders(request, options.requestHeaders);
        applyAttribution(request, response);

        const sessionToken = getSessionCookie(request, {
            cookiePrefix: 'rutacero',
        });
        const hasUser = Boolean(sessionToken);

        if (!hasUser && isAppRoute) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }

        if (hasUser && isAuthRoute) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }

        return response;
    } catch (error) {
        const response = nextWithHeaders(request, options.requestHeaders);
        const message = error instanceof Error ? error.message : 'unknown_middleware_error';
        response.headers.set('x-rutacero-middleware-error', message.slice(0, 180));
        return response;
    }
}
