import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightsSection } from './insights-section';
import type { Insight } from '@/lib/insights';

const NOW = '2026-05-15T12:00:00.000Z';

const sample: Insight[] = [
    {
        id: 'cost-monthly-interest',
        category: 'cost',
        severity: 'info',
        title: 'Interés mensual estimado',
        body: 'Actualmente pagás aproximadamente Q200.00 al mes solo en intereses.',
        computedAt: NOW,
    },
    {
        id: 'composition-total-debts',
        category: 'composition',
        severity: 'info',
        title: 'Resumen de tus deudas',
        body: 'Tenés 2 deudas activas por un total aproximado de Q15,000.00.',
        cta: { label: 'Ver deudas', href: '/debts' },
        computedAt: NOW,
    },
];

describe('InsightsSection', () => {
    it('renders nothing when there are no insights', () => {
        const { container } = render(<InsightsSection insights={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the section title, all insight cards, and the legal disclaimer', () => {
        render(<InsightsSection insights={sample} />);

        // Section header
        expect(
            screen.getByRole('heading', { level: 3, name: /Análisis automático/i }),
        ).toBeInTheDocument();

        // Each insight title rendered
        expect(screen.getByText(/Interés mensual estimado/i)).toBeInTheDocument();
        expect(screen.getByText(/Resumen de tus deudas/i)).toBeInTheDocument();

        // CTA link
        const cta = screen.getByRole('link', { name: /Ver deudas/i });
        expect(cta).toBeInTheDocument();
        expect(cta).toHaveAttribute('href', '/debts');

        // Legal disclaimer present
        expect(screen.getByRole('complementary', { name: /Aviso legal/i })).toBeInTheDocument();
    });
});
