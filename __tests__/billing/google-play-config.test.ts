import { describe, it, expect, afterEach, vi } from 'vitest';
import { getGooglePlayPublicConfig, getGooglePlayPassDurationDays } from '@/lib/billing/google-play-config';

describe('Google Play pass duration parsing', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it('defaults to 30 when env is unset', () => {
        expect(getGooglePlayPassDurationDays()).toBe(30);
        expect(getGooglePlayPublicConfig().passDurationDays).toBe(30);
    });

    it('accepts a valid value (90)', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '90');
        expect(getGooglePlayPassDurationDays()).toBe(90);
        expect(getGooglePlayPublicConfig().passDurationDays).toBe(90);
    });

    it('falls back to server var when NEXT_PUBLIC is unset', () => {
        vi.stubEnv('GOOGLE_PLAY_PASS_DURATION_DAYS', '60');
        expect(getGooglePlayPassDurationDays()).toBe(60);
    });

    it('NEXT_PUBLIC takes precedence over server var', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '90');
        vi.stubEnv('GOOGLE_PLAY_PASS_DURATION_DAYS', '60');
        expect(getGooglePlayPassDurationDays()).toBe(90);
    });

    it('clamps zero to default', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '0');
        expect(getGooglePlayPassDurationDays()).toBe(30);
    });

    it('clamps negative to default', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '-5');
        expect(getGooglePlayPassDurationDays()).toBe(30);
    });

    it('clamps above MAX (365) to default', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '366');
        expect(getGooglePlayPassDurationDays()).toBe(30);
    });

    it('accepts MAX boundary exactly', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '365');
        expect(getGooglePlayPassDurationDays()).toBe(365);
    });

    it('rejects non-numeric string', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', 'abc');
        expect(getGooglePlayPassDurationDays()).toBe(30);
    });

    it('rejects fractional values', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '1.5');
        expect(getGooglePlayPassDurationDays()).toBe(30);
    });

    it('rejects empty string', () => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_PASS_DURATION_DAYS', '');
        expect(getGooglePlayPassDurationDays()).toBe(30);
    });
});
