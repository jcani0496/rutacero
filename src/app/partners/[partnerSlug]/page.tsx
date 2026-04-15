import { LandingSurface } from '@/components/landing/landing-surface';
import { resolveLaunchExperience } from '@/lib/launch/experience';

export default async function PartnerLandingPage({
    params,
    searchParams,
}: {
    params: Promise<{ partnerSlug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ partnerSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
    const experience = resolveLaunchExperience({
        partnerSlug,
        searchParams: resolvedSearchParams,
    });

    return <LandingSurface experience={experience} />;
}
