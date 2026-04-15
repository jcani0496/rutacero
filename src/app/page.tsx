import { redirect } from 'next/navigation';

import { LandingSurface } from '@/components/landing/landing-surface';
import { resolveLaunchExperience } from '@/lib/launch/experience';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // If there's a code parameter, redirect to auth callback
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  if (code) {
    redirect(`/auth/callback?code=${code}`);
  }

  const experience = resolveLaunchExperience({ searchParams: params });

  return <LandingSurface experience={experience} />;
}
