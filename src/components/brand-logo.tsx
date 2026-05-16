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
     * - 'light' (default): for white/slate-50 backgrounds — emails, marketing,
     *   mobile auth right-panel forms. Uses public/logo.svg with slate "Ruta"
     *   and emerald-600 "Cero" inside a slate icon container.
     * - 'dark': for slate-900 / slate-950 backgrounds — auth layout left
     *   panel (desktop). Uses public/logo-dark.svg where the icon floats
     *   without a container square and "Ruta" is white.
     */
    variant?: 'light' | 'dark';
}

export function BrandLogo({
    className,
    height,
    priority = false,
    variant = 'light',
}: BrandLogoProps) {
    const src = variant === 'dark' ? '/logo-dark.svg' : '/logo.svg';
    return (
        <Image
            src={src}
            alt="RutaCero"
            width={320}
            height={80}
            {...(priority ? { priority: true } : {})}
            className={cn('w-auto', className)}
            style={{ height, width: 'auto' }}
        />
    );
}
