import { redirect } from 'next/navigation';
import { SettingsClient } from './settings-client';
import { requireUserTenant } from '@/lib/tenant/server';

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

    // Get user profile
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    // Get subscription
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
