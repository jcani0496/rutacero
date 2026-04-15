import { describe, expect, it, vi } from 'vitest';

import {
    calculateGooglePlayPassExpiresAt,
    createGooglePlayObfuscatedAccountId,
    isGooglePlaySubscriptionExpired,
} from '@/lib/billing/google-play';

describe('google-play billing helpers', () => {
    it('builds a stable obfuscated account id', () => {
        const first = createGooglePlayObfuscatedAccountId('550e8400-e29b-41d4-a716-446655440001');
        const second = createGooglePlayObfuscatedAccountId('550e8400-e29b-41d4-a716-446655440001');

        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(first).toBe(second);
    });

    it('calculates a pass expiry window from the purchase completion time', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

        expect(
            calculateGooglePlayPassExpiresAt('2026-04-14T00:00:00.000Z', 30)
        ).toBe('2026-05-14T00:00:00.000Z');

        vi.useRealTimers();
    });

    it('detects expired Google Play entitlements from the subscription row', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

        expect(
            isGooglePlaySubscriptionExpired({
                provider: 'google_play',
                plan_code: 'PRO',
                status: 'ACTIVE',
                renew_at: '2026-04-13T23:59:59.000Z',
            })
        ).toBe(true);
        expect(
            isGooglePlaySubscriptionExpired({
                provider: 'recurrente',
                plan_code: 'PRO',
                status: 'ACTIVE',
                renew_at: '2026-04-13T23:59:59.000Z',
            })
        ).toBe(false);

        vi.useRealTimers();
    });
});
