'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
    className?: string;
    height: number;
    priority?: boolean;
    /**
     * Background context of the surface the logo will render on.
     *
     * - 'auto' (default): for theme-aware surfaces (dashboard sidebar,
     *   app header sheet, sticky mobile nav, anywhere the bg color flips
     *   between light and dark mode). Renders BOTH variants and lets
     *   Tailwind's dark: class toggle which one is visible. Zero JS, no
     *   theme-hook needed — pure CSS via the .dark root class.
     *
     * - 'light': always render public/logo.svg. Use on surfaces that are
     *   ALWAYS light regardless of theme (e.g., emails, marketing pages
     *   pinned to a light hero).
     *
     * - 'dark': always render public/logo-dark.svg. Use on surfaces that
     *   are ALWAYS dark regardless of theme (e.g. a dark marketing strip).
     */
    variant?: 'auto' | 'light' | 'dark';
}

export function BrandLogo({
    className,
    height,
    priority = false,
    variant = 'auto',
}: BrandLogoProps) {
    const sharedStyle = { height, width: 'auto' } as const;
    const priorityProps = priority ? { priority: true as const } : {};

    if (variant === 'light') {
        return (
            <Image
                src="/logo.svg"
                alt="RutaCero"
                width={320}
                height={80}
                {...priorityProps}
                className={cn('w-auto', className)}
                style={sharedStyle}
            />
        );
    }

    if (variant === 'dark') {
        return (
            <Image
                src="/logo-dark.svg"
                alt="RutaCero"
                width={320}
                height={80}
                {...priorityProps}
                className={cn('w-auto', className)}
                style={sharedStyle}
            />
        );
    }

    // 'auto' — render both, let CSS show the correct one per active theme.
    // Both are rendered (small SVGs, ~1.5KB each) so no JS / theme hook
    // is needed and the correct asset is in the DOM at first paint.
    return (
        <>
            <Image
                src="/logo.svg"
                alt="RutaCero"
                width={320}
                height={80}
                {...priorityProps}
                className={cn('w-auto dark:hidden', className)}
                style={sharedStyle}
            />
            <Image
                src="/logo-dark.svg"
                alt=""
                width={320}
                height={80}
                {...priorityProps}
                className={cn('hidden w-auto dark:block', className)}
                style={sharedStyle}
                aria-hidden="true"
            />
        </>
    );
}
