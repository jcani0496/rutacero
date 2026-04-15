import { describe, expect, it, vi } from 'vitest';

import { openRecurrenteCheckout } from '@/lib/recurrente/open-checkout';

describe('openRecurrenteCheckout', () => {
    it('opens the native browser on Capacitor platforms', async () => {
        const openExternalBrowser = vi.fn().mockResolvedValue(undefined);
        const assign = vi.fn();

        const mode = await openRecurrenteCheckout('https://checkout.rutacero.test', {
            isNativePlatform: true,
            openExternalBrowser,
            assign,
        });

        expect(mode).toBe('external_browser');
        expect(openExternalBrowser).toHaveBeenCalledWith('https://checkout.rutacero.test');
        expect(assign).not.toHaveBeenCalled();
    });

    it('keeps the browser redirect in web mode', async () => {
        const openExternalBrowser = vi.fn().mockResolvedValue(undefined);
        const assign = vi.fn();

        const mode = await openRecurrenteCheckout('https://checkout.rutacero.test', {
            isNativePlatform: false,
            openExternalBrowser,
            assign,
        });

        expect(mode).toBe('same_tab');
        expect(assign).toHaveBeenCalledWith('https://checkout.rutacero.test');
        expect(openExternalBrowser).not.toHaveBeenCalled();
    });
});
