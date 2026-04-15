'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
    className?: string;
    height: number;
    priority?: boolean;
}

export function BrandLogo({ className, height, priority = false }: BrandLogoProps) {
    return (
        <Image
            src="/logo.svg"
            alt="RutaCero"
            width={1545}
            height={660}
            {...(priority ? { priority: true } : {})}
            className={cn('w-auto', className)}
            style={{ height, width: 'auto' }}
        />
    );
}
