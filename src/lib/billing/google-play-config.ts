export interface GooglePlayPublicConfig {
    packageName: string;
    productId: string;
    passDurationDays: number;
    mockMode: boolean;
}

const DEFAULT_PACKAGE_NAME = 'com.rutacero.app';
const DEFAULT_PRODUCT_ID = 'pro_pass_30d';
const DEFAULT_PASS_DURATION_DAYS = 30;

function env(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
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
    const passDurationDays = Number.parseInt(
        env('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS') ||
        env('GOOGLE_PLAY_PASS_DURATION_DAYS') ||
        String(DEFAULT_PASS_DURATION_DAYS),
        10
    );

    return {
        packageName,
        productId,
        passDurationDays: Number.isFinite(passDurationDays) && passDurationDays > 0
            ? passDurationDays
            : DEFAULT_PASS_DURATION_DAYS,
        mockMode: process.env.GOOGLE_PLAY_MOCK_MODE === 'true',
    };
}
