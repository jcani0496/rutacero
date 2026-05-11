import type { ImgHTMLAttributes } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    push: vi.fn(),
    trackMarketingEvent: vi.fn(),
    upsert: vi.fn(),
}));

vi.mock('next/image', () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt ?? ''} />;
    },
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mocks.push,
    }),
}));

vi.mock('@/lib/funnel/client', () => ({
    trackMarketingEvent: mocks.trackMarketingEvent,
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        auth: {
            getUser: mocks.getUser,
        },
        from: () => ({
            upsert: mocks.upsert,
        }),
    }),
}));

import OnboardingPage from './page';

describe('OnboardingPage', () => {
    beforeEach(() => {
        mocks.getUser.mockReset();
        mocks.push.mockReset();
        mocks.trackMarketingEvent.mockReset();
        mocks.upsert.mockReset();

        mocks.getUser.mockResolvedValue({
            data: {
                user: { id: 'user-123' },
            },
        });
        mocks.upsert.mockResolvedValue({ error: null });
        mocks.trackMarketingEvent.mockResolvedValue(undefined);
    });

    const goToCompleteStep = () => {
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    };

    it('exposes progress and selected currency semantics on the first step', () => {
        render(<OnboardingPage />);

        expect(screen.getByRole('progressbar', { name: /progreso del onboarding/i })).toHaveAttribute('aria-valuenow', '20');
        expect(screen.getByRole('radiogroup', { name: /cuál es tu moneda principal/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /quetzales/i })).toBeChecked();
        expect(screen.getByText('1. Moneda').closest('li')).toHaveAttribute('aria-current', 'step');
    });

    it('updates radio selection and progress metadata on later steps', () => {
        render(<OnboardingPage />);

        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

        const leastInterest = screen.getByRole('radio', { name: /pagar menos intereses/i });
        fireEvent.click(leastInterest);

        expect(screen.getByRole('radiogroup', { name: /cuál es tu objetivo principal/i })).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: /progreso del onboarding/i })).toHaveAttribute('aria-valuenow', '60');
        expect(leastInterest).toBeChecked();
        expect(screen.getByText('3. Objetivo').closest('li')).toHaveAttribute('aria-current', 'step');
    });

    it('shows the motivation step between goal and complete', () => {
        render(<OnboardingPage />);

        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

        expect(screen.getByRole('radiogroup', { name: /qué te trajo a rutacero/i })).toBeInTheDocument();
        expect(screen.getByText('4. Motivación').closest('li')).toHaveAttribute('aria-current', 'step');
        expect(screen.getByRole('button', { name: /saltar este paso/i })).toBeInTheDocument();
    });

    it('persists the selected motivation when submitting', async () => {
        render(<OnboardingPage />);

        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

        fireEvent.click(screen.getByRole('radio', { name: /quiero ahorrar en intereses/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /ir al dashboard/i }));

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));

        expect(mocks.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ onboarding_motivation: 'SAVE_INTEREST' }),
            expect.anything(),
        );
    });

    it('skipping the motivation step persists null motivation', async () => {
        render(<OnboardingPage />);

        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
        fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

        fireEvent.click(screen.getByRole('button', { name: /saltar este paso/i }));
        fireEvent.click(screen.getByRole('button', { name: /ir al dashboard/i }));

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));

        expect(mocks.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ onboarding_motivation: null }),
            expect.anything(),
        );
    });

    it('shows an inline actionable alert when the profile cannot be saved', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.getUser.mockResolvedValue({
            data: {
                user: null,
            },
        });

        render(<OnboardingPage />);
        goToCompleteStep();
        fireEvent.click(screen.getByRole('button', { name: /ir al dashboard/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/tu sesión expiró/i);
        expect(mocks.push).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('submits onboarding data and redirects on success', async () => {
        render(<OnboardingPage />);
        goToCompleteStep();
        fireEvent.click(screen.getByRole('button', { name: /ir al dashboard/i }));

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));

        expect(mocks.upsert).toHaveBeenCalled();
        expect(mocks.trackMarketingEvent).toHaveBeenCalledWith({
            eventName: 'onboarding_completed',
            ctaContext: 'signup',
        });
    });

    it('has no obvious accessibility violations on the first step', async () => {
        const { container } = render(<OnboardingPage />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
