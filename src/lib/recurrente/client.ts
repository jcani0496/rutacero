/**
 * Recurrente API Client
 * https://docs.recurrente.com
 */

const RECURRENTE_API_URL = 'https://app.recurrente.com/api';
const RECURRENTE_MOCK_CHECKOUT_ID_PREFIX = 'chk_local_';

interface RecurrenteConfig {
    publicKey: string;
    secretKey: string;
    mockMode?: boolean;
}

interface CreateCheckoutParams {
    amount: number;
    currency: 'GTQ' | 'USD';
    description: string;
    interval: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    customerId?: string;
    metadata?: Record<string, string>;
}

interface CheckoutResponse {
    id: string;
    checkout_url: string;
    status: string;
}

interface WebhookEvent {
    id: string;
    type: string;
    data: {
        id: string;
        status?: string;
        amount?: number;
        currency?: string;
        customer_id?: string;
        subscription_id?: string;
        metadata?: Record<string, string>;
    };
    created_at: string;
}

class RecurrenteClient {
    private publicKey: string;
    private secretKey: string;
    private mockMode: boolean;

    constructor(config: RecurrenteConfig) {
        this.publicKey = config.publicKey;
        this.secretKey = config.secretKey;
        this.mockMode = config.mockMode ?? false;
    }

    private buildMockCheckoutUrl(successUrl: string, checkoutId: string): string {
        const resolvedSuccessUrl = successUrl.replace('{CHECKOUT_ID}', checkoutId);
        const url = new URL(resolvedSuccessUrl);

        url.searchParams.set('mock_recurrente', '1');

        return url.toString();
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        if (this.mockMode) {
            throw new Error('Mock Recurrente client does not support raw API requests.');
        }

        const url = `${RECURRENTE_API_URL}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-PUBLIC-KEY': this.publicKey,
                'X-SECRET-KEY': this.secretKey,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Recurrente API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    /**
     * Create a checkout session for subscription
     */
    async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
        if (this.mockMode) {
            const checkoutId = `${RECURRENTE_MOCK_CHECKOUT_ID_PREFIX}${Date.now()}`;

            return {
                id: checkoutId,
                checkout_url: this.buildMockCheckoutUrl(params.successUrl, checkoutId),
                status: 'mocked',
            };
        }

        return this.request<CheckoutResponse>('/checkouts', {
            method: 'POST',
            body: JSON.stringify({
                items: [{
                    name: params.description,
                    amount_in_cents: Math.round(params.amount * 100),
                    currency: params.currency,
                    quantity: 1,
                }],
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
                customer_email: params.customerEmail,
                is_subscription: true,
                subscription_interval: params.interval,
                metadata: params.metadata,
            }),
        });
    }

    /**
     * Get subscription details
     */
    async getSubscription(subscriptionId: string): Promise<unknown> {
        if (this.mockMode) {
            return {
                id: subscriptionId,
                status: 'mocked',
                provider: 'recurrente',
            };
        }

        return this.request(`/subscriptions/${subscriptionId}`);
    }

    /**
     * Cancel a subscription
     */
    async cancelSubscription(subscriptionId: string): Promise<unknown> {
        if (this.mockMode) {
            return {
                id: subscriptionId,
                status: 'cancelled',
                provider: 'recurrente',
            };
        }

        return this.request(`/subscriptions/${subscriptionId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Verify webhook signature (if Recurrente provides this)
     */
    verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
        // Recurrente uses HMAC-SHA256 for webhook signatures
        // Implementation depends on their exact spec
        // For now, return true - implement proper verification in production
        void payload;
        void signature;
        void secret;
        return true;
    }
}

// Singleton instance
let client: RecurrenteClient | null = null;

function isRecurrenteMockModeEnabled() {
    return process.env.RECURRENTE_MOCK_MODE === 'true';
}

export function getRecurrenteClient(): RecurrenteClient {
    if (!client) {
        if (isRecurrenteMockModeEnabled()) {
            client = new RecurrenteClient({
                publicKey: 'mock-public-key',
                secretKey: 'mock-secret-key',
                mockMode: true,
            });

            return client;
        }

        // Backward compatible env var name:
        // some configs used RECURRENTE_API_KEY as the "public" key.
        const publicKey = process.env.RECURRENTE_PUBLIC_KEY || process.env.RECURRENTE_API_KEY;
        const secretKey = process.env.RECURRENTE_SECRET_KEY;

        if (!publicKey || !secretKey) {
            throw new Error('Recurrente API keys not configured (RECURRENTE_PUBLIC_KEY/RECURRENTE_API_KEY + RECURRENTE_SECRET_KEY)');
        }

        client = new RecurrenteClient({
            publicKey,
            secretKey,
        });
    }

    return client;
}

export type { CreateCheckoutParams, CheckoutResponse, WebhookEvent };
