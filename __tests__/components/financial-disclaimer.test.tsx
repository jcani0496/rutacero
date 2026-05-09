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
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('Superintendencia de Bancos');
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('RutaCero');
    });
});
