'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const CHECK_INTERVAL_MS = 30000;

export function SessionGuard() {
    const pathname = usePathname();
    const inFlightRef = useRef(false);

    const checkStatus = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const response = await fetch('/api/auth/ban-status', { cache: 'no-store' });
            if (!response.ok) return;
            const data = (await response.json()) as { blocked?: boolean };
            if (data?.blocked) {
                const { authClient } = await import('@/lib/auth/client');
                await authClient.signOut();
                window.location.href = '/login?blocked=1';
            }
        } catch (error) {
            console.error('Session guard error:', error);
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [pathname, checkStatus]);

    useEffect(() => {
        const id = setInterval(checkStatus, CHECK_INTERVAL_MS);
        return () => clearInterval(id);
    }, [checkStatus]);

    return null;
}
