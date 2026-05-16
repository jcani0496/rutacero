import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    FinancialDisclaimer,
    FINANCIAL_DISCLAIMER_TEXT,
} from '@/components/legal/financial-disclaimer';

describe('FinancialDisclaimer', () => {
    it('renders default variant as a labeled aside landmark with the canonical text', () => {
        render(<FinancialDisclaimer />);
        const landmark = screen.getByRole('complementary', { name: 'Aviso legal' });
        expect(landmark).toBeInTheDocument();
        expect(landmark.tagName).toBe('ASIDE');
        expect(landmark).toHaveTextContent(FINANCIAL_DISCLAIMER_TEXT);
    });

    it('renders compact variant as a labeled aside landmark wrapping a paragraph', () => {
        render(<FinancialDisclaimer variant="compact" />);
        const landmark = screen.getByRole('complementary', { name: 'Aviso legal' });
        expect(landmark).toBeInTheDocument();
        expect(landmark.tagName).toBe('ASIDE');
        expect(landmark.querySelector('p')).not.toBeNull();
        expect(landmark).toHaveTextContent(FINANCIAL_DISCLAIMER_TEXT);
    });

    it('appends an optional className', () => {
        render(<FinancialDisclaimer className="custom-class" />);
        const landmark = screen.getByRole('complementary', { name: 'Aviso legal' });
        expect(landmark.className).toContain('custom-class');
    });

    it('exports the canonical text constant for email reuse', () => {
        // The canonical disclaimer is consumed by email templates that can't
        // import the React component. Assert on the load-bearing legal claims.
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('RutaCero');
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('no constituye asesoría');
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('único responsable');
    });

    it('renders custom text when the text prop is provided (back-compat)', () => {
        render(<FinancialDisclaimer text="Texto personalizado para esta superficie." />);
        const landmark = screen.getByRole('complementary', { name: 'Aviso legal' });
        expect(landmark).toHaveTextContent('Texto personalizado para esta superficie.');
    });
});
