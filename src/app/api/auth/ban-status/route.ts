import { NextResponse } from 'next/server';

import { isIdentityUserBanned } from '@/lib/auth/identity';
import { getAppUser } from '@/lib/auth/session';

export async function GET() {
    try {
        const user = await getAppUser();
        if (!user) {
            return NextResponse.json({ blocked: false });
        }

        const blocked = await isIdentityUserBanned(user.id);
        return NextResponse.json({ blocked });
    } catch (error) {
        console.error('Ban status check failed:', error);
        return NextResponse.json({ blocked: false });
    }
}
