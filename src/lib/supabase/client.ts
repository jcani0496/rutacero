import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

const AUTH_COOKIE_NAME = 'rutacero-auth';

export function createClient() {
    const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        (typeof window !== 'undefined'
            ? `http://${window.location.hostname}:54321`
            : 'http://127.0.0.1:54321');

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    return createBrowserClient<Database>(
        supabaseUrl,
        anonKey,
        {
            // Important: use a stable cookie name so SSR/middleware can read the same
            // session regardless of whether Supabase is accessed via localhost or a LAN IP.
            cookieOptions: { name: AUTH_COOKIE_NAME },
            auth: {
                flowType: process.env.NODE_ENV === 'development' ? 'implicit' : 'pkce',
                detectSessionInUrl: true,
                persistSession: true,
            },
        }
    );
}
