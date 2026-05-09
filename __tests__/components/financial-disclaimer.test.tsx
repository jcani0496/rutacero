import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    FinancialDisclaimer,
    FINANCIAL_DISCLAIMER_TEXT,
} from '@/components/legal/financial-disclaimer';

describe('FinancialDisclaimer', () => {
    it('renders default variant with the canonical text and a note role', () => {
        render(<FinancialDisclaimer />);
        const note = screen.getByRole('note');
        expect(note).toBeInTheDocument();
        expect(note).toHaveTextContent(FINANCIAL_DISCLAIMER_TEXT);
    });

    it('renders compact variant with the canonical text and a note role', () => {
        render(<FinancialDisclaimer variant="compact" />);
        const note = screen.getByRole('note');
        expect(note).toBeInTheDocument();
        expect(note.tagName).toBe('P');
        expect(note).toHaveTextContent(FINANCIAL_DISCLAIMER_TEXT);
    });

    it('appends an optional className', () => {
        render(<FinancialDisclaimer className="custom-class" />);
        const note = screen.getByRole('note');
        expect(note.className).toContain('custom-class');
    });

    it('exports the canonical text constant for email reuse', () => {
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('Superintendencia de Bancos');
        expect(FINANCIAL_DISCLAIMER_TEXT).toContain('RutaCero');
    });
});
