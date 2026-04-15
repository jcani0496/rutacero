import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getGooglePlayPublicConfig } from '@/lib/billing/google-play-config';
export { getGooglePlayPublicConfig } from '@/lib/billing/google-play-config';

export type GooglePlayPurchaseState = 'PURCHASED' | 'PENDING' | 'CANCELED';

export interface VerifiedGooglePlayPurchase {
    purchaseToken: string;
    productId: string;
    orderId: string | null;
    purchaseState: GooglePlayPurchaseState;
    purchaseCompletedAt: string | null;
    obfuscatedExternalAccountId: string | null;
    regionCode: string | null;
    acknowledgementState: string | null;
    consumptionState: string | null;
    raw: unknown;
}

interface GooglePlayTokenCache {
    accessToken: string;
    expiresAtMs: number;
}

interface GooglePlayProductLineItem {
    productId?: string;
    consumptionState?: string;
}

interface GooglePlayPurchaseV2Response {
    acknowledgementState?: string;
    obfuscatedExternalAccountId?: string;
    orderId?: string;
    productLineItem?: GooglePlayProductLineItem[];
    purchaseCompletionTime?: string;
    purchaseStateContext?: {
        purchaseState?: string;
    };
    regionCode?: string;
}

const GOOGLE_PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const GOOGLE_PLAY_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let accessTokenCache: GooglePlayTokenCache | null = null;

function env(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function getGooglePlayPrivateConfig() {
    const serviceAccountEmail = env('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL');
    const serviceAccountPrivateKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    return {
        ...getGooglePlayPublicConfig(),
        serviceAccountEmail,
        serviceAccountPrivateKey,
    };
}

export function createGooglePlayObfuscatedAccountId(userId: string): string {
    const salt =
        env('GOOGLE_PLAY_ACCOUNT_SALT') ||
        env('GOOGLE_PLAY_PACKAGE_NAME') ||
        getGooglePlayPublicConfig().packageName;

    return crypto
        .createHash('sha256')
        .update(`${salt}:${userId}`)
        .digest('hex');
}

export function calculateGooglePlayPassExpiresAt(
    purchaseCompletedAt: string | null,
    durationDays = getGooglePlayPublicConfig().passDurationDays
): string {
    const purchasedAtMs = purchaseCompletedAt ? Date.parse(purchaseCompletedAt) : Date.now();

    return new Date(
        purchasedAtMs + durationDays * 24 * 60 * 60 * 1000
    ).toISOString();
}

export function isGooglePlaySubscriptionExpired(subscription: {
    provider?: string | null;
    plan_code?: string | null;
    renew_at?: string | null;
    status?: string | null;
} | null | undefined): boolean {
    if (!subscription) return false;
    if (subscription.provider !== 'google_play') return false;
    if (!subscription.renew_at) return false;
    if (subscription.plan_code === 'FREE') return false;
    if (subscription.status !== 'ACTIVE') return false;

    return Date.parse(subscription.renew_at) <= Date.now();
}

function mapPurchaseState(rawState: string | undefined): GooglePlayPurchaseState {
    switch (rawState) {
        case 'PURCHASED':
            return 'PURCHASED';
        case 'PENDING':
            return 'PENDING';
        default:
            return 'CANCELED';
    }
}

async function getGoogleAccessToken(): Promise<string> {
    const config = getGooglePlayPrivateConfig();

    if (config.mockMode) {
        return 'mock-google-play-token';
    }

    if (!config.serviceAccountEmail || !config.serviceAccountPrivateKey) {
        throw new Error('Google Play service account credentials are missing');
    }

    if (accessTokenCache && accessTokenCache.expiresAtMs > Date.now() + 60_000) {
        return accessTokenCache.accessToken;
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
        {
            iss: config.serviceAccountEmail,
            scope: GOOGLE_PLAY_SCOPE,
            aud: GOOGLE_PLAY_TOKEN_URL,
            iat: issuedAt,
            exp: issuedAt + 3600,
        },
        config.serviceAccountPrivateKey,
        { algorithm: 'RS256' }
    );

    const response = await fetch(GOOGLE_PLAY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });

    if (!response.ok) {
        throw new Error(`Google OAuth token exchange failed with status ${response.status}`);
    }

    const json = await response.json() as {
        access_token?: string;
        expires_in?: number;
    };

    if (!json.access_token) {
        throw new Error('Google OAuth token exchange did not return an access token');
    }

    accessTokenCache = {
        accessToken: json.access_token,
        expiresAtMs: Date.now() + (json.expires_in || 3600) * 1000,
    };

    return json.access_token;
}

export async function verifyGooglePlayPurchase(input: {
    purchaseToken: string;
    productId: string;
}): Promise<VerifiedGooglePlayPurchase> {
    const config = getGooglePlayPrivateConfig();

    if (config.mockMode) {
        return {
            purchaseToken: input.purchaseToken,
            productId: input.productId,
            orderId: 'GPA.0000-0000-0000-00000',
            purchaseState: 'PURCHASED',
            purchaseCompletedAt: new Date().toISOString(),
            obfuscatedExternalAccountId: null,
            regionCode: 'GT',
            acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
            consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
            raw: {
                mockMode: true,
            },
        };
    }

    const accessToken = await getGoogleAccessToken();
    const response = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/productsv2/tokens/${encodeURIComponent(input.purchaseToken)}`,
        {
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Google Play purchase verification failed with status ${response.status}`);
    }

    const raw = await response.json() as GooglePlayPurchaseV2Response;
    const productLineItem = raw.productLineItem?.find((item) => item.productId === input.productId);

    if (!productLineItem) {
        throw new Error('Verified Google Play purchase does not contain the expected product');
    }

    return {
        purchaseToken: input.purchaseToken,
        productId: productLineItem.productId || input.productId,
        orderId: raw.orderId || null,
        purchaseState: mapPurchaseState(raw.purchaseStateContext?.purchaseState),
        purchaseCompletedAt: raw.purchaseCompletionTime || null,
        obfuscatedExternalAccountId: raw.obfuscatedExternalAccountId || null,
        regionCode: raw.regionCode || null,
        acknowledgementState: raw.acknowledgementState || null,
        consumptionState: productLineItem.consumptionState || null,
        raw,
    };
}

export async function consumeGooglePlayPurchase(input: {
    purchaseToken: string;
    productId: string;
}): Promise<void> {
    const config = getGooglePlayPrivateConfig();

    if (config.mockMode) {
        return;
    }

    const accessToken = await getGoogleAccessToken();
    const response = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:consume`,
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Google Play purchase consume failed with status ${response.status}`);
    }
}
