import { registerPlugin } from '@capacitor/core';

export interface GooglePlayProductDetails {
    currencyCode: string | null;
    description: string;
    formattedPrice: string | null;
    offerToken: string | null;
    priceAmountMicros: number | null;
    productId: string;
    title: string;
}

export interface GooglePlayPurchase {
    acknowledged: boolean;
    orderId: string | null;
    productId: string;
    purchaseState: 'PURCHASED' | 'PENDING';
    purchaseTime: number | null;
    purchaseToken: string;
}

export interface GooglePlayBillingPlugin {
    getProductDetails(options: { productIds: string[] }): Promise<{ products: GooglePlayProductDetails[] }>;
    isAvailable(): Promise<{ available: boolean }>;
    purchaseProduct(options: {
        obfuscatedAccountId?: string | null;
        productId: string;
    }): Promise<{ purchase: GooglePlayPurchase }>;
}

export const GooglePlayBilling = registerPlugin<GooglePlayBillingPlugin>('GooglePlayBilling');
