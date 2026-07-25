import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { SkipToContentLink } from "@/components/accessibility/skip-to-content-link";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/features/app-sidebar";
import { AppHeader } from "@/components/features/app-header";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SessionGuard } from "@/components/features/session-guard";
import { getUserNotificationSnapshot, syncUserNotificationsForUser, type UserNotification } from "@/lib/actions/user-notifications";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { ensureCurrentTenantForUser } from "@/lib/tenant/server";
import { getAppUser } from "@/lib/auth/session";
import { isIdentityUserBanned } from "@/lib/auth/identity";
import { isBetterAuthEnabled } from "@/lib/auth/provider";
import { getAuth } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Gestiona tus deudas y alcanza la libertad financiera",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const appUser = await getAppUser();

  if (!appUser) {
    redirect("/login");
  }

  // Keep a Supabase-shaped user object for existing child components until F3.
  let user: User | null = null;
  if (isBetterAuthEnabled()) {
    user = {
      id: appUser.id,
      email: appUser.email,
      user_metadata: { full_name: appUser.name, name: appUser.name },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User;
  } else {
    user = (await supabase.auth.getUser()).data.user;
  }

  if (!user) {
    redirect("/login");
  }

  try {
    if (await isIdentityUserBanned(user.id)) {
      if (isBetterAuthEnabled()) {
        await getAuth().api.signOut({ headers: await headers() });
      } else {
        await supabase.auth.signOut();
      }
      redirect("/login?blocked=1");
    }
  } catch {
    // If ban lookup fails, fall back to allowing access.
  }

  // Check onboarding status
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("onboarding_completed, current_tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileData as { onboarding_completed: boolean; current_tenant_id?: string | null } | null;

  const tenantId = profile?.current_tenant_id || (await ensureCurrentTenantForUser(user.id));

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  // Get subscription status
  const { data: subscriptionData } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("tenant_id", tenantId)
    .eq("status", "ACTIVE")
    .single();

  const planCode = subscriptionData?.plan_code || "FREE";
  const isPro = planCode === "PRO" || planCode === "BUSINESS";

  let initialNotifications: UserNotification[] = [];
  let initialUnreadCount = 0;
  try {
    await syncUserNotificationsForUser(user.id, tenantId);
    const snapshot = await getUserNotificationSnapshot(user.id, tenantId, 8);
    initialNotifications = snapshot.notifications;
    initialUnreadCount = snapshot.unreadCount;
  } catch {
    // Ignore notification sync errors
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <SkipToContentLink />
      <SessionGuard />
      {/* Desktop Sidebar */}
      <AppSidebar user={user} isPro={isPro} planCode={planCode} />

      {/* Main content area */}
      <div className="lg:pl-72">
        {/* Header */}
        <AppHeader
          user={user}
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />

        {/* Main content with bottom padding for mobile nav */}
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="min-h-[calc(100vh-4rem)] p-4 pb-20 focus:outline-none md:pb-4 lg:p-8"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
