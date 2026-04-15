import { LandingSurface } from '@/components/landing/landing-surface';
import { resolveLaunchExperience } from '@/lib/launch/experience';

export default async function PublicLandingPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const experience = resolveLaunchExperience({ searchParams: resolvedSearchParams });

    return <LandingSurface experience={experience} />;
}
