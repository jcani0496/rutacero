'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Get user's timezone from profile
 * INFO-011: Timezone personalizado por usuario
 *
 * @returns User's timezone (e.g., 'America/Guatemala')
 */
export async function getUserTimezone(): Promise<string> {
    const DEFAULT_TIMEZONE = 'America/Guatemala';

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return DEFAULT_TIMEZONE;
        }

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('timezone')
            .eq('user_id', user.id)
            .single();

        return profile?.timezone || DEFAULT_TIMEZONE;
    } catch (error) {
        console.error('Error fetching user timezone:', error);
        return DEFAULT_TIMEZONE;
    }
}

/**
 * Format date with user's timezone
 * INFO-011: Timezone personalizado por usuario
 *
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @param timezone - Optional timezone override
 * @returns Formatted date string
 */
export async function formatDateWithTimezone(
    date: Date | string,
    options: Intl.DateTimeFormatOptions = {
        month: 'short',
        year: 'numeric',
    },
    timezone?: string
): Promise<string> {
    const userTimezone = timezone || await getUserTimezone();
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return dateObj.toLocaleDateString('es-GT', {
        ...options,
        timeZone: userTimezone,
    });
}

/**
 * Get current date in user's timezone
 * INFO-011: Timezone personalizado por usuario
 *
 * @param timezone - Optional timezone override
 * @returns Date object
 */
export async function getNowInTimezone(timezone?: string): Promise<Date> {
    const userTimezone = timezone || await getUserTimezone();
    const now = new Date();

    // Format and parse to get date in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: userTimezone,
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

    return new Date(year, month, day, hour, minute, second);
}
