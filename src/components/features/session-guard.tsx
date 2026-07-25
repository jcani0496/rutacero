'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const CHECK_INTERVAL_MS = 30000;

export function SessionGuard() {
    const pathname = usePathname();
    const supabase = useMemo(() => createClient(), []);
    const inFlightRef = useRef(false);

    const checkStatus = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const response = await fetch('/api/auth/ban-status', { cache: 'no-store' });
            if (!response.ok) return;
            const data = (await response.json()) as { blocked?: boolean };
            if (data?.blocked) {
                const useBetterAuth =
                    (process.env.NEXT_PUBLIC_AUTH_PROVIDER || '').toLowerCase() === 'better-auth';
                if (useBetterAuth) {
                    const { authClient } = await import('@/lib/auth/client');
                    await authClient.signOut();
                } else {
                    await supabase.auth.signOut();
                }
                window.location.href = '/login?blocked=1';
            }
        } catch (error) {
            console.error('Session guard error:', error);
        } finally {
            inFlightRef.current = false;
        }
    }, [supabase]);

    useEffect(() => {
        checkStatus();
    }, [pathname, checkStatus]);

    useEffect(() => {
        const id = setInterval(checkStatus, CHECK_INTERVAL_MS);
        return () => clearInterval(id);
    }, [checkStatus]);

    return null;
}
