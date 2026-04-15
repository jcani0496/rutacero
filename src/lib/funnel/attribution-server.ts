import { cookies } from 'next/headers';

import {
    ATTRIBUTION_COOKIE_NAME,
    type AttributionState,
    parseAttributionCookie,
} from '@/lib/funnel/attribution';

export async function readAttributionStateFromCookies(): Promise<AttributionState | null> {
    const cookieStore = await cookies();
    return parseAttributionCookie(cookieStore.get(ATTRIBUTION_COOKIE_NAME)?.value);
}
