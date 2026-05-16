'use client';

import { useState, useSyncExternalStore } from 'react';
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
        // Treat as "no decision yet" and let the banner show — writes
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

// useSyncExternalStore subscriber. We don't actually listen for cross-tab
// storage changes here (no compliance need for it); the no-op subscribe is
// just to satisfy the API and keep SSR/client snapshots aligned.
function subscribe(): () => void {
    return () => {};
}

function getServerSnapshot(): ConsentValue | null {
    return null;
}

export function CookieBanner() {
    const pathname = usePathname();
    // Forces a re-render when consent is written locally without
    // triggering React 19's setState-in-effect lint.
    const [tick, setTick] = useState(0);
    const stored = useSyncExternalStore(subscribe, readConsent, getServerSnapshot);

    // While SSR is matching, useSyncExternalStore returns the server snapshot
    // (null). On the first client tick it returns the real value. We treat
    // "stored !== null" OR "user just dismissed via tick > 0" as hidden.
    const shouldShow = stored === null && tick === 0;

    // Never show the banner on the cookies page itself — redundant.
    if (!shouldShow || pathname === '/cookies') {
        return null;
    }

    const handleAccept = () => {
        writeConsent('accepted');
        setTick((t) => t + 1);
    };

    const handleEssentialOnly = () => {
        writeConsent('essential-only');
        setTick((t) => t + 1);
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
