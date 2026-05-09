export interface GooglePlayPublicConfig {
    packageName: string;
    productId: string;
    passDurationDays: number;
    mockMode: boolean;
}

const DEFAULT_PACKAGE_NAME = 'com.rutacero.app';
const DEFAULT_PRODUCT_ID = 'pro_pass_30d';
const DEFAULT_PASS_DURATION_DAYS = 30;
const MAX_PASS_DURATION_DAYS = 365;

function env(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function parsePassDurationDays(raw: string | undefined): number {
    if (!raw) return DEFAULT_PASS_DURATION_DAYS;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_PASS_DURATION_DAYS) {
        return DEFAULT_PASS_DURATION_DAYS;
    }
    return n;
}

export function getGooglePlayPassDurationDays(): number {
    return parsePassDurationDays(
        env('GOOGLE_PLAY_PASS_DURATION_DAYS') ||
        env('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS')
    );
}

export function getGooglePlayPublicConfig(): GooglePlayPublicConfig {
    const packageName =
        env('NEXT_PUBLIC_GOOGLE_PLAY_PACKAGE_NAME') ||
        env('GOOGLE_PLAY_PACKAGE_NAME') ||
        DEFAULT_PACKAGE_NAME;
    const productId =
        env('NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID') ||
        env('GOOGLE_PLAY_PRODUCT_ID') ||
        DEFAULT_PRODUCT_ID;
    const passDurationDays = parsePassDurationDays(
        env('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS') ||
        env('GOOGLE_PLAY_PASS_DURATION_DAYS')
    );

    return {
        packageName,
        productId,
        passDurationDays,
        mockMode: process.env.GOOGLE_PLAY_MOCK_MODE === 'true',
    };
}
