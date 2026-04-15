import { Capacitor } from '@capacitor/core';

export type CheckoutOpenMode = 'same_tab' | 'external_browser';

interface OpenCheckoutOptions {
    isNativePlatform?: boolean;
    openExternalBrowser?: (url: string) => Promise<void>;
    assign?: (url: string) => void;
}

async function openInNativeBrowser(url: string) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
}

export async function openRecurrenteCheckout(
    url: string,
    options: OpenCheckoutOptions = {}
): Promise<CheckoutOpenMode> {
    const isNativePlatform = options.isNativePlatform ?? Capacitor.isNativePlatform();

    if (isNativePlatform) {
        const openExternalBrowser = options.openExternalBrowser ?? openInNativeBrowser;
        await openExternalBrowser(url);
        return 'external_browser';
    }

    const assign = options.assign ?? ((nextUrl: string) => window.location.assign(nextUrl));
    assign(url);
    return 'same_tab';
}
