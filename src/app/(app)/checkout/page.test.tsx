import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    searchParams: new URLSearchParams(),
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
    openRecurrenteCheckout: vi.fn(),
    buildTrackedHref: vi.fn((href: string) => href),
    getGooglePlayPublicConfig: vi.fn(() => ({
        productId: 'rutacero.pro',
        packageName: 'gt.rutacero.app',
        passDurationDays: 30,
    })),
    googlePlayIsAvailable: vi.fn(),
    googlePlayGetProductDetails: vi.fn(),
    googlePlayPurchaseProduct: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => mocks.searchParams,
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: mocks.isNativePlatform,
        getPlatform: mocks.getPlatform,
    },
}));

vi.mock('@/components/funnel/dropoff-capture', () => ({
    DropoffCapture: ({ defaultOpen, title }: { defaultOpen: boolean; title?: string }) => (
        <div data-testid="dropoff-capture">
            <span>{defaultOpen ? 'open' : 'closed'}</span>
            {title ? <span>{title}</span> : null}
        </div>
    ),
}));

vi.mock('@/lib/billing/google-play-config', () => ({
    getGooglePlayPublicConfig: mocks.getGooglePlayPublicConfig,
}));

vi.mock('@/lib/billing/google-play-plugin', () => ({
    GooglePlayBilling: {
        isAvailable: mocks.googlePlayIsAvailable,
        getProductDetails: mocks.googlePlayGetProductDetails,
        purchaseProduct: mocks.googlePlayPurchaseProduct,
    },
}));

vi.mock('@/lib/launch/experience', () => ({
    buildTrackedHref: mocks.buildTrackedHref,
}));

vi.mock('@/lib/recurrente/open-checkout', () => ({
    openRecurrenteCheckout: mocks.openRecurrenteCheckout,
}));

import CheckoutPage from './page';

describe('CheckoutPage', () => {
    beforeEach(() => {
        mocks.searchParams = new URLSearchParams();
        mocks.isNativePlatform.mockReset();
        mocks.getPlatform.mockReset();
        mocks.openRecurrenteCheckout.mockReset();
        mocks.buildTrackedHref.mockClear();
        mocks.getGooglePlayPublicConfig.mockClear();
        mocks.googlePlayIsAvailable.mockReset();
        mocks.googlePlayGetProductDetails.mockReset();
        mocks.googlePlayPurchaseProduct.mockReset();
        mocks.fetch.mockReset();

        mocks.isNativePlatform.mockReturnValue(false);
        mocks.getPlatform.mockReturnValue('web');
        mocks.openRecurrenteCheckout.mockResolvedValue('same_tab');
        mocks.googlePlayIsAvailable.mockResolvedValue(undefined);
        mocks.googlePlayGetProductDetails.mockResolvedValue({ products: [] });
        mocks.fetch.mockImplementation(async () =>
            new Response(JSON.stringify({ checkoutUrl: 'https://checkout.recurrente.test/chk_123' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        vi.stubGlobal('fetch', mocks.fetch);
    });

    it('shows a consistent cancel-state message and opens dropoff capture when checkout is canceled', async () => {
        mocks.searchParams = new URLSearchParams('canceled=true');

        render(<CheckoutPage />);

        expect(await screen.findByText('El pago fue cancelado. Podés intentar de nuevo cuando quieras.')).toBeVisible();
        expect(screen.getByTestId('dropoff-capture')).toHaveTextContent('open');
        expect(screen.getByTestId('dropoff-capture')).toHaveTextContent('Vimos que cancelaste el cobro');
    });

    it('creates a checkout session and opens the recurrente flow in web mode', async () => {
        render(<CheckoutPage />);

        fireEvent.click(screen.getByRole('button', { name: 'Suscribirse Ahora' }));

        await waitFor(() =>
            expect(mocks.fetch).toHaveBeenCalledWith('/api/recurrente/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ctaContext: 'checkout',
                    variantCode: 'PRO_ANNUAL',
                }),
            })
        );

        await waitFor(() =>
            expect(mocks.openRecurrenteCheckout).toHaveBeenCalledWith(
                'https://checkout.recurrente.test/chk_123'
            )
        );
    });
});
