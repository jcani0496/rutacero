import { redirect } from 'next/navigation';
import { SettingsClient } from './settings-client';
import { requireUserTenant } from '@/lib/tenant/server';
import { getCurrentUserProfile } from '@/lib/actions/profile';

export const metadata = {
    title: 'Configuración | RutaCero',
    description: 'Configurá tu perfil y preferencias',
};

export default async function SettingsPage() {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        redirect('/login');
    }

    const profile = await getCurrentUserProfile();

    // Subscriptions stay on PostgREST until F3g (funnel/billing).
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <SettingsClient
                user={user}
                profile={profile}
                subscription={subscription}
            />
        </div>
    );
}
