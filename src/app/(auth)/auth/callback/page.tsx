'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const next = searchParams.get('next') ?? '/dashboard';

            if (code) {
                try {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

                    if (error) {
                        setError(error.message);
                        setTimeout(() => router.push('/login?error=auth_callback_error'), 3000);
                        return;
                    }

                    if (data?.session) {
                        // Check if user has completed onboarding
                        const { data: profileData } = await supabase
                            .from('user_profiles')
                            .select('onboarding_completed')
                            .eq('user_id', data.session.user.id)
                            .single();

                        const profile = profileData as { onboarding_completed: boolean } | null;

                        // Redirect based on onboarding status
                        if (!profile?.onboarding_completed) {
                            router.push('/onboarding');
                        } else {
                            router.push(next);
                        }
                        return;
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Error de autenticación');
                    setTimeout(() => router.push('/login?error=auth_callback_error'), 3000);
                }
            } else {
                // No code, try to get session from URL hash (implicit flow fallback)
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    router.push('/dashboard');
                } else {
                    router.push('/login');
                }
            }
        };

        handleCallback();
    }, [searchParams, router, supabase]);

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
