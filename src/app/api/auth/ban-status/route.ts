import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ blocked: false });
        }

        const adminClient = createAdminClient();
        const { data } = await adminClient.auth.admin.getUserById(user.id);
        const bannedUntil = (data?.user as { banned_until?: string | null } | null)?.banned_until ?? null;
        const blocked = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();

        return NextResponse.json({ blocked, banned_until: bannedUntil });
    } catch (error) {
        console.error('Ban status check failed:', error);
        return NextResponse.json({ blocked: false });
    }
}
