import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    signUpEmail: vi.fn(),
    trackMarketingEvent: vi.fn(),
    recordSignupConsent: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/auth/client', () => ({
    authClient: {
        signUp: {
            email: mocks.signUpEmail,
        },
    },
}));

vi.mock('@/lib/funnel/client', () => ({
    trackMarketingEvent: mocks.trackMarketingEvent,
}));

vi.mock('@/lib/actions/consent', () => ({
    recordSignupConsent: mocks.recordSignupConsent,
}));

vi.mock('@/components/brand-logo', () => ({
    BrandLogo: () => <div>Logo</div>,
}));

vi.mock('@/components/funnel/dropoff-capture', () => ({
    DropoffCapture: () => null,
}));

import SignupPage from './page';

describe('SignupPage terms checkbox', () => {
    beforeEach(() => {
        mocks.push.mockReset();
        mocks.signUpEmail.mockReset();
        mocks.trackMarketingEvent.mockReset();
        mocks.recordSignupConsent.mockReset();
    });

    it('keeps Enviar código disabled until terms are accepted', () => {
        render(<SignupPage />);

        const submit = screen.getByRole('button', { name: /enviar código/i });
        expect(submit).toBeDisabled();

        const checkbox = screen.getByRole('checkbox', { name: /he leído y acepto/i });
        fireEvent.click(checkbox);

        expect(checkbox).toBeChecked();
        expect(submit).not.toBeDisabled();
    });

    it('enables submit when clicking the label text', () => {
        render(<SignupPage />);

        const submit = screen.getByRole('button', { name: /enviar código/i });
        const labelText = screen.getByText(/he leído y acepto los/i);

        fireEvent.click(labelText);

        expect(screen.getByRole('checkbox', { name: /he leído y acepto/i })).toBeChecked();
        expect(submit).not.toBeDisabled();
    });
});
