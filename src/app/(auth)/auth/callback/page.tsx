'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { getOnboardingStatus } from '@/lib/actions/profile';
import { Loader2 } from 'lucide-react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const next = searchParams.get('next') ?? '/dashboard';

            try {
                const session = await authClient.getSession();
                if (!session.data?.session) {
                    router.push('/login');
                    return;
                }

                const status = await getOnboardingStatus();
                if (!status?.onboardingCompleted) {
                    router.push('/onboarding');
                } else {
                    router.push(next);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error de autenticación');
                setTimeout(() => router.push('/login?error=auth_callback_error'), 3000);
            }
        };

        void handleCallback();
    }, [searchParams, router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
            <div className="text-center space-y-4">
                {error ? (
                    <>
                        <div className="text-destructive text-lg font-medium">
                            Error de autenticación
                        </div>
                        <p className="text-muted-foreground text-sm max-w-md">
                            {error}
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Redirigiendo al login...
                        </p>
                    </>
                ) : (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">
                            Verificando tu sesión...
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen flex-col items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">
                        Cargando...
                    </p>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
