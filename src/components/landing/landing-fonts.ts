import { Manrope } from 'next/font/google';

/**
 * Marketing-only typeface. Scoped to the public landing via the
 * `.rc-landing` wrapper (see globals.css) — the app shell keeps
 * Geist Sans. Humanistic grotesk reads as "product documentation",
 * not another AI-SaaS Inter/Geist page.
 */
export const manrope = Manrope({
    subsets: ['latin'],
    weight: ['500', '600', '700', '800'],
    variable: '--font-manrope',
    display: 'swap',
});

export const landingFontVariables = manrope.variable;
