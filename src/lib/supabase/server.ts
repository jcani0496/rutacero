import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

const AUTH_COOKIE_NAME = 'rutacero-auth';

export async function createClient() {
    const cookieStore = await cookies();

    const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        'http://127.0.0.1:54321';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    return createServerClient<Database>(
        supabaseUrl,
        anonKey,
        {
            cookieOptions: { name: AUTH_COOKIE_NAME },
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing user sessions.
                    }
                },
            },
        }
    );
}

// Admin client with service role key (can access auth.users)
export function createAdminClient() {
    const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        'http://127.0.0.1:54321';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    return createSupabaseJsClient<Database>(
        supabaseUrl,
        serviceRole
    );
}
