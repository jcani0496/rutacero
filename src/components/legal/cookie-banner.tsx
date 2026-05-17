'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
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

    // Council v4 #4 — auto-dismiss on scroll past 400px. If the user is engaged
    // enough to scroll, treat that as implicit consent for essentials-only cookies.
    // This is honest because the banner explicitly states "No usamos cookies
    // publicitarias ni de seguimiento de terceros."
    //
    // NOTE: hook must run unconditionally per rules-of-hooks; guards live inside.
    useEffect(() => {
        if (!shouldShow) return;
        if (typeof window === 'undefined') return;

        const onScroll = () => {
            if (window.scrollY > 400) {
                writeConsent('essential-only');
                setTick((t) => t + 1);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [shouldShow]);

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
            // z-40 keeps the banner BELOW the sticky mobile nav (z-50) so the
            // primary CTA stays tappable on first paint. Council v4 #4 fix.
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-lg backdrop-blur"
        >
            <div className="container mx-auto flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5">
                <p className="text-xs text-foreground sm:max-w-xl sm:text-sm">
                    <strong>Cookies esenciales para mantenerte conectado.</strong>{' '}
                    Sin publicidad ni seguimiento de terceros.{' '}
                    <Link
                        href="/cookies"
                        className="underline underline-offset-2 hover:text-primary"
                    >
                        Política
                    </Link>
                    .
                </p>
                <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEssentialOnly}
                        className="h-8 px-3 text-xs"
                    >
                        Solo esenciales
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleAccept}
                        className="h-8 px-3 text-xs"
                    >
                        Aceptar
                    </Button>
                </div>
            </div>
        </div>
    );
}
