export const ATTRIBUTION_COOKIE_NAME = 'rutacero-attribution';

const MAX_TRACKING_VALUE_LENGTH = 120;

export interface AttributionSnapshot {
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

export interface AttributionState {
    attributionId: string;
    firstTouch: AttributionSnapshot | null;
    lastTouch: AttributionSnapshot | null;
    updatedAt: string;
}

export interface MarketingContext {
    attributionId: string;
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
    firstTouch: AttributionSnapshot | null;
    lastTouch: AttributionSnapshot | null;
}

export interface TrackingOverrides {
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

export type MarketingChannel =
    | 'direct'
    | 'partner'
    | 'referral'
    | 'email'
    | 'paid_social'
    | 'organic_social'
    | 'paid_search'
    | 'organic_search'
    | 'display'
    | 'sms'
    | 'other';

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

export function deriveMarketingChannel(input: {
    source?: string | null;
    medium?: string | null;
    partnerSlug?: string | null;
    referralCode?: string | null;
}): MarketingChannel {
    const source = sanitizeTrackingValue(input.source)?.toLowerCase() || null;
    const medium = sanitizeTrackingValue(input.medium)?.toLowerCase() || null;
    const partnerSlug = sanitizeTrackingValue(input.partnerSlug);
    const referralCode = sanitizeTrackingValue(input.referralCode);

    if (referralCode || medium === 'referral') return 'referral';

    if (
        medium === 'email' ||
        medium === 'newsletter' ||
        medium === 'email_marketing' ||
        source === 'email' ||
        source === 'mailchimp' ||
        source === 'resend'
    ) {
        return 'email';
    }

    if (medium === 'sms' || medium === 'whatsapp' || source === 'sms' || source === 'whatsapp') {
        return 'sms';
    }

    if (
        medium === 'display' ||
        medium === 'banner' ||
        medium === 'programmatic'
    ) {
        return 'display';
    }

    const isSocialSource = Boolean(source && ['meta', 'facebook', 'instagram', 'tiktok', 'linkedin', 'x'].includes(source));
    const isSearchSource = Boolean(source && ['google', 'bing', 'yahoo'].includes(source));

    if (
        medium === 'paid_social' ||
        medium === 'social_paid' ||
        medium === 'social_ads' ||
        (isSocialSource && Boolean(medium && ['cpc', 'ppc', 'paid', 'paid_social'].includes(medium)))
    ) {
        return 'paid_social';
    }

    if (medium === 'social' || medium === 'organic_social' || isSocialSource) {
        return 'organic_social';
    }

    if (
        medium === 'cpc' ||
        medium === 'ppc' ||
        medium === 'sem' ||
        medium === 'paid_search' ||
        (isSearchSource && Boolean(medium && ['cpc', 'ppc', 'paid', 'sem'].includes(medium)))
    ) {
        return 'paid_search';
    }

    if (medium === 'organic' || medium === 'seo' || isSearchSource) {
        return 'organic_search';
    }

    if (partnerSlug) return 'partner';

    if (!source && !medium) return 'direct';

    return 'other';
}

export function inferCtaContextFromPath(pathname: string | null | undefined): string | null {
    if (!pathname) return null;
    if (pathname === '/' || pathname === '') return 'landing';
    if (pathname.startsWith('/pricing')) return 'pricing';
    if (pathname.startsWith('/plan')) return 'plan';
    if (pathname.startsWith('/checkout')) return 'checkout';
    if (pathname.startsWith('/signup')) return 'signup';
    if (pathname.startsWith('/payments')) return 'support_recovery_path';
    return null;
}

export function parseAttributionCookie(rawValue: string | null | undefined): AttributionState | null {
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

export function encodeAttributionCookie(state: AttributionState): string {
    return encodeURIComponent(JSON.stringify(state));
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

export function extractTrackingOverrides(
    searchParams: URLSearchParams,
    pathname: string
): TrackingOverrides {
    return {
        source: sanitizeTrackingValue(searchParams.get('utm_source') || searchParams.get('source')),
        medium: sanitizeTrackingValue(searchParams.get('utm_medium') || searchParams.get('medium')),
        campaignId: sanitizeTrackingValue(searchParams.get('campaign_id')),
        campaignName: sanitizeTrackingValue(searchParams.get('utm_campaign') || searchParams.get('campaign_name')),
        creativeId: sanitizeTrackingValue(searchParams.get('creative_id')),
        creativeName: sanitizeTrackingValue(searchParams.get('creative_name') || searchParams.get('utm_content')),
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

export function mergeAttributionState(
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
        existingFirst ||
        (snapshotHasMeaningfulFields(nextSnapshot) ? nextSnapshot : null);

    const nextLastTouch =
        snapshotHasMeaningfulFields(nextSnapshot)
            ? nextSnapshot
            : existing?.lastTouch ?? null;

    return {
        attributionId: existing?.attributionId || attributionIdFactory(),
        firstTouch: nextFirstTouch,
        lastTouch: nextLastTouch,
        updatedAt: new Date().toISOString(),
    };
}

export function createMarketingContext(
    state: AttributionState | null,
    overrides: TrackingOverrides = {}
): MarketingContext {
    const merged = sanitizeSnapshot({
        ...(state?.firstTouch ?? {}),
        ...(state?.lastTouch ?? {}),
        ...overrides,
        capturedAt: new Date().toISOString(),
    });

    return {
        attributionId: state?.attributionId || crypto.randomUUID(),
        source: merged.source,
        medium: merged.medium,
        campaignId: merged.campaignId,
        campaignName: merged.campaignName,
        creativeId: merged.creativeId,
        creativeName: merged.creativeName,
        partnerSlug: merged.partnerSlug,
        referralCode: merged.referralCode,
        landingVariant: merged.landingVariant,
        offerVariant: merged.offerVariant,
        ctaContext: merged.ctaContext,
        path: merged.path,
        firstTouch: state?.firstTouch ?? null,
        lastTouch: state?.lastTouch ?? null,
    };
}

export function marketingContextFromMetadata(
    metadata: Record<string, unknown> | null | undefined
): MarketingContext | null {
    if (!metadata) return null;

    const firstTouch = parseJsonSnapshot(metadata.first_touch_json);
    const lastTouch = parseJsonSnapshot(metadata.last_touch_json);
    const attributionId = sanitizeTrackingValue(stringOrNull(metadata.attribution_id));

    if (!attributionId) {
        return null;
    }

    return {
        attributionId,
        source: sanitizeTrackingValue(stringOrNull(metadata.source)),
        medium: sanitizeTrackingValue(stringOrNull(metadata.medium)),
        campaignId: sanitizeTrackingValue(stringOrNull(metadata.campaign_id)),
        campaignName: sanitizeTrackingValue(stringOrNull(metadata.campaign_name)),
        creativeId: sanitizeTrackingValue(stringOrNull(metadata.creative_id)),
        creativeName: sanitizeTrackingValue(stringOrNull(metadata.creative_name)),
        partnerSlug: sanitizeTrackingValue(stringOrNull(metadata.partner_slug)),
        referralCode: sanitizeTrackingValue(stringOrNull(metadata.referral_code)),
        landingVariant: sanitizeTrackingValue(stringOrNull(metadata.landing_variant)),
        offerVariant: sanitizeTrackingValue(stringOrNull(metadata.offer_variant)),
        ctaContext: sanitizeTrackingValue(stringOrNull(metadata.cta_context)),
        path: sanitizeTrackingValue(stringOrNull(metadata.path)),
        firstTouch,
        lastTouch,
    };
}

function parseJsonSnapshot(rawValue: unknown): AttributionSnapshot | null {
    if (typeof rawValue !== 'string' || !rawValue.trim()) return null;

    try {
        return sanitizeSnapshot(JSON.parse(rawValue) as Partial<AttributionSnapshot>);
    } catch {
        return null;
    }
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
