import { headers } from "next/headers";

import { getAuth } from "@/lib/auth/server";
import { isBetterAuthEnabled } from "@/lib/auth/provider";
import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
};

/**
 * Unified session reader for the migration window.
 * Returns null when unauthenticated.
 */
export async function getAppUser(): Promise<AppUser | null> {
  if (isBetterAuthEnabled()) {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return {
    id: user.id,
    email: user.email,
    name:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}
