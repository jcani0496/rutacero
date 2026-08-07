'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

const SHOW_AFTER_PX = 400;

interface StickyMobileNavProps {
    primaryHref?: string;
    primaryLabel?: string;
}

export function StickyMobileNav({
    primaryHref = '/signup',
    primaryLabel = 'Empezar gratis',
}: StickyMobileNavProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-40 md:hidden border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-transform duration-200 motion-reduce:transition-none ${
                visible ? 'translate-y-0' : '-translate-y-full'
            }`}
            aria-hidden={!visible}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
                <Link href="/" className="flex items-center gap-2" aria-label="Inicio">
                    <BrandLogo height={28} variant="light" />
                </Link>
                <Button
                    asChild
                    size="sm"
                    className="bg-[#111111] text-white hover:bg-[#2A2A2A]"
                >
                    <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
            </div>
        </div>
    );
}
