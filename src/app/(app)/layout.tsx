import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SkipToContentLink } from "@/components/accessibility/skip-to-content-link";
import { AppSidebar } from "@/components/features/app-sidebar";
import { AppHeader } from "@/components/features/app-header";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SessionGuard } from "@/components/features/session-guard";
import { getUserNotificationSnapshot, syncUserNotificationsForUser, type UserNotification } from "@/lib/actions/user-notifications";
import { getCurrentUserProfile } from "@/lib/actions/profile";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { ensureCurrentTenantForUser } from "@/lib/tenant/server";
import { getAppUser, type AppUser } from "@/lib/auth/session";
import { isIdentityUserBanned } from "@/lib/auth/identity";
import { getAuth } from "@/lib/auth/server";
import { getDb, schema } from "@/db/client";
import { rcFontVariables } from "@/lib/theme/rc-fonts";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Gestiona tus deudas y alcanza la libertad financiera",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await getAppUser();

  if (!appUser) {
    redirect("/login");
  }

  const user: AppUser = appUser;

  try {
    if (await isIdentityUserBanned(user.id)) {
      await getAuth().api.signOut({ headers: await headers() });
      redirect("/login?blocked=1");
    }
  } catch {
    // If ban lookup fails, fall back to allowing access.
  }

  const profile = await getCurrentUserProfile();

  const tenantId = profile?.current_tenant_id || (await ensureCurrentTenantForUser(user.id));

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const db = getDb();
  const [subscription] = await db
    .select({ planCode: schema.subscriptions.planCode, status: schema.subscriptions.status })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.tenantId, tenantId))
    .limit(1);

  const planCode = subscription?.status === "ACTIVE" ? (subscription.planCode || "FREE") : "FREE";
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
    <div className={`rc-surface rc-app min-h-screen bg-background ${rcFontVariables}`}>
      <SkipToContentLink />
      <SessionGuard />
      <AppSidebar user={user} isPro={isPro} planCode={planCode} />

      <div className="lg:pl-72">
        <AppHeader
          user={user}
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="min-h-[calc(100vh-4rem)] p-4 pb-20 focus:outline-none md:pb-4 lg:p-8"
        >
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
