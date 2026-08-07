import { Manrope } from 'next/font/google';

/**
 * Marketing-adjacent typeface for paper-theme surfaces (landing, app,
 * admin, auth). Scoped via layout wrappers with `.rc-surface`.
 */
export const manrope = Manrope({
    subsets: ['latin'],
    weight: ['500', '600', '700', '800'],
    variable: '--font-manrope',
    display: 'swap',
});

export const rcFontVariables = manrope.variable;
