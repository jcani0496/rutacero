import { headers } from "next/headers";

import { getAuth } from "@/lib/auth/server";

export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
  /** Compat shape for getDisplayName / legacy UI props. */
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
};

/**
 * Session reader (F6: better-auth only).
 * Returns null when unauthenticated.
 */
export async function getAppUser(): Promise<AppUser | null> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    user_metadata: {
      full_name: session.user.name,
      name: session.user.name,
    },
  };
}
