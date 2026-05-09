import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { FINANCIAL_DISCLAIMER_TEXT } from '@/components/legal/financial-disclaimer';
import { LifecycleEmail } from '@/lib/emails/lifecycle-email';
import { PaymentReminderEmail } from '@/lib/emails/payment-reminder';

describe('Email templates include financial disclaimer', () => {
    it('lifecycle-email contains the canonical disclaimer text', async () => {
        const html = await render(
            <LifecycleEmail
                preview="Test preview"
                title="Test title"
                intro="Test intro"
                ctaLabel="Continuar"
                ctaUrl="https://rutacero.app"
            />,
        );
        expect(html).toContain(FINANCIAL_DISCLAIMER_TEXT);
    });

    it('payment-reminder contains the canonical disclaimer text', async () => {
        const html = await render(
            <PaymentReminderEmail
                userName="Juan"
                debts={[
                    {
                        creditor: 'Banco X',
                        amount: 1000,
                        currency: 'GTQ',
                        dueDate: '2026-05-15',
                        daysUntilDue: 3,
                    },
                ]}
                dashboardUrl="https://rutacero.app"
            />,
        );
        expect(html).toContain(FINANCIAL_DISCLAIMER_TEXT);
    });
});
