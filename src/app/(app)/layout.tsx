import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SkipToContentLink } from "@/components/accessibility/skip-to-content-link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/features/app-sidebar";
import { AppHeader } from "@/components/features/app-header";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SessionGuard } from "@/components/features/session-guard";
import { getUserNotificationSnapshot, syncUserNotificationsForUser, type UserNotification } from "@/lib/actions/user-notifications";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { ensureCurrentTenantForUser } from "@/lib/tenant/server";

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
  const adminClient = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const { data: authData } = await adminClient.auth.admin.getUserById(user.id);
    const bannedUntil = (authData?.user as { banned_until?: string | null } | null)?.banned_until ?? null;
    if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
      await supabase.auth.signOut();
      redirect("/login?blocked=1");
    }
  } catch {
    // If admin lookup fails, fall back to allowing access.
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
