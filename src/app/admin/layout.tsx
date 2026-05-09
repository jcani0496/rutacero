import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { SkipToContentLink } from '@/components/accessibility/skip-to-content-link';
import { AdminSidebar } from '@/components/features/AdminSidebar';
import { MAIN_CONTENT_ID } from '@/lib/accessibility';

export const metadata = {
    title: 'Admin | RutaCero',
    description: 'Panel de administración',
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getAdminSession();

    const allowedNav = session
        ? (
            await Promise.all(
                [
                    { href: '/admin/dashboard', permission: 'dashboard:read' },
                    { href: '/admin/notifications', permission: 'notifications:read' },
                    { href: '/admin/users', permission: 'users:read' },
                    { href: '/admin/staff', permission: 'staff:read' },
                    { href: '/admin/reports', permission: 'reports:read' },
                    { href: '/admin/funnel', permission: 'reports:read' },
                    { href: '/admin/billing/manual-grant', permission: 'subscriptions:update' },
                    { href: '/admin/audit', permission: 'audit:read' },
                    { href: '/admin/support', permission: 'tickets:read' },
                    { href: '/admin/settings', permission: 'settings:read' },
                ].map(async (item) =>
                    (await roleHasPermission(session.role, item.permission)) ? item.href : null
                )
            )
        ).filter((item): item is string => Boolean(item))
        : [];

    // Redirect to login if not authenticated (except for login page)
    // This is handled at page level, layout just wraps

    return (
        <div className="flex min-h-screen bg-background">
            <SkipToContentLink />
            {session && <AdminSidebar session={session} allowedNav={allowedNav} />}
            <main
                id={MAIN_CONTENT_ID}
                tabIndex={-1}
                className={session ? "flex-1 pt-16 focus:outline-none lg:pt-0 lg:pl-72" : "flex-1 focus:outline-none"}
            >
                {children}
            </main>
        </div>
    );
}
