'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'rutacero-cookie-consent';

type ConsentValue = 'accepted' | 'essential-only';

function readConsent(): ConsentValue | null {
    if (typeof window === 'undefined') return null;
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        if (value === 'accepted' || value === 'essential-only') return value;
        return null;
    } catch {
        // localStorage may throw in private browsing or when disabled.
        // Treat as "no decision yet" and let the banner show — but writes
        // below also wrap in try/catch so the banner still dismisses in-memory.
        return null;
    }
}

function writeConsent(value: ConsentValue) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
        // Ignore — banner will hide via state regardless.
    }
}

export function CookieBanner() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (readConsent() === null) {
            setVisible(true);
        }
    }, []);

    // Never show the banner on the cookies page itself — it would be redundant.
    if (!mounted || !visible || pathname === '/cookies') {
        return null;
    }

    const handleAccept = () => {
        writeConsent('accepted');
        setVisible(false);
    };

    const handleEssentialOnly = () => {
        writeConsent('essential-only');
        setVisible(false);
    };

    return (
        <div
            role="region"
            aria-label="Cookie consent"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card shadow-lg"
        >
            <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm text-foreground sm:max-w-2xl">
                    <strong>Esta web usa cookies esenciales para mantenerte conectado.</strong>{' '}
                    No usamos cookies publicitarias ni de seguimiento de terceros. Más información
                    en nuestra{' '}
                    <Link
                        href="/cookies"
                        className="underline underline-offset-2 hover:text-primary"
                    >
                        Política de cookies
                    </Link>
                    .
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEssentialOnly}
                        className="text-sm"
                    >
                        Solo esenciales
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleAccept}
                        className="text-sm"
                    >
                        Aceptar
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-sm"
                    >
                        <Link href="/cookies">Más información</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
