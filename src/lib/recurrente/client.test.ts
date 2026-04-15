import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadClientModule() {
    vi.resetModules();
    return import('@/lib/recurrente/client');
}

describe('Recurrente client', () => {
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.restoreAllMocks();
    });

    it('creates a local checkout without dashboard keys when mock mode is enabled', async () => {
        process.env.RECURRENTE_MOCK_MODE = 'true';
        delete process.env.RECURRENTE_PUBLIC_KEY;
        delete process.env.RECURRENTE_API_KEY;
        delete process.env.RECURRENTE_SECRET_KEY;

        const { getRecurrenteClient } = await loadClientModule();
        const client = getRecurrenteClient();
        const checkout = await client.createCheckout({
            amount: 49,
            currency: 'GTQ',
            description: 'RutaCero PRO',
            interval: 'monthly',
            successUrl: 'http://localhost:3000/checkout/success?session_id={CHECKOUT_ID}',
            cancelUrl: 'http://localhost:3000/checkout?canceled=true',
        });

        expect(checkout.status).toBe('mocked');
        expect(checkout.id).toMatch(/^chk_local_/);
        expect(checkout.checkout_url).toContain(`/checkout/success?session_id=${checkout.id}`);
        expect(checkout.checkout_url).toContain('mock_recurrente=1');
    });

    it('throws when live mode is used without the required Recurrente keys', async () => {
        process.env.RECURRENTE_MOCK_MODE = 'false';
        delete process.env.RECURRENTE_PUBLIC_KEY;
        delete process.env.RECURRENTE_API_KEY;
        delete process.env.RECURRENTE_SECRET_KEY;

        const { getRecurrenteClient } = await loadClientModule();

        expect(() => getRecurrenteClient()).toThrow(
            'Recurrente API keys not configured (RECURRENTE_PUBLIC_KEY/RECURRENTE_API_KEY + RECURRENTE_SECRET_KEY)'
        );
    });
});
