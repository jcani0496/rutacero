'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    SquaresFour,
    Users,
    ChatCircle,
    Gear,
    SignOut,
    Shield,
    Table,
    Bell,
    FileText,
    List,
} from '@phosphor-icons/react';
import { ICON, type PhosphorIcon } from '@/components/icons/phosphor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { adminLogout, type AdminSession } from '@/lib/actions/admin-auth';
import { NotificationBell } from '@/components/admin/NotificationBell';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

interface AdminSidebarProps {
    session: AdminSession;
    allowedNav?: string[];
}

const navItems: { href: string; label: string; icon: PhosphorIcon }[] = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: SquaresFour },
    { href: '/admin/notifications', label: 'Notificaciones', icon: Bell },
    { href: '/admin/users', label: 'Clientes', icon: Users },
    { href: '/admin/staff', label: 'Personal RutaCero', icon: Shield },
    { href: '/admin/reports', label: 'Reportes', icon: Table },
    { href: '/admin/audit', label: 'Auditoría', icon: FileText },
    { href: '/admin/support', label: 'Soporte', icon: ChatCircle },
    { href: '/admin/settings', label: 'Configuración', icon: Gear },
];

export function AdminSidebar({ session, allowedNav }: AdminSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        setMobileOpen(false);
        await adminLogout();
        router.push('/admin/login');
    };

    const roleLabels: Record<string, string> = {
        SUPER_ADMIN: 'Super Admin',
        ADMIN: 'Administrador',
        SUPPORT: 'Soporte',
        ANALYST: 'Analista',
    };

    const visibleNav = allowedNav?.length
        ? navItems.filter((item) => allowedNav.includes(item.href))
        : navItems;

    const renderNavLinks = (onNavigate?: () => void) =>
        visibleNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
                <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                        'flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                            ? 'border-primary bg-accent text-foreground'
                            : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
                    )}
                >
                    <item.icon {...ICON} className={cn('h-5 w-5', isActive && 'text-primary')} />
                    {item.label}
                </Link>
            );
        });

    return (
        <>
            <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="Abrir navegación admin">
                            <List {...ICON} className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-72 max-w-[85vw] bg-card p-0"
                        aria-describedby={undefined}
                    >
                        <SheetHeader className="border-b border-border pr-14">
                            <div className="flex items-center gap-2">
                                <Shield {...ICON} className="h-5 w-5 text-primary" />
                                <SheetTitle className="text-base">RutaCero Admin</SheetTitle>
                            </div>
                            <SheetDescription>
                                {roleLabels[session.role]} · {session.displayName || session.email}
                            </SheetDescription>
                        </SheetHeader>
                        <SheetBody className="px-4 py-4">
                            <nav className="space-y-1">{renderNavLinks(() => setMobileOpen(false))}</nav>
                        </SheetBody>
                        <SheetFooter className="gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{session.displayName || session.email}</p>
                                <p className="text-xs text-muted-foreground">{session.email}</p>
                            </div>
                            <Button variant="outline" className="w-full" onClick={handleLogout}>
                                <SignOut {...ICON} className="h-4 w-4" />
                                Cerrar Sesión
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Shield {...ICON} className="h-5 w-5 text-primary" />
                        <span className="truncate text-base font-semibold">RutaCero Admin</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{roleLabels[session.role]}</p>
                </div>
                <NotificationBell />
            </div>

            <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border bg-card lg:flex">
                <div className="flex h-16 items-center justify-between border-b border-border px-6">
                    <div className="flex items-center gap-2.5">
                        <Shield {...ICON} className="h-5 w-5 text-primary" />
                        <div className="leading-tight">
                            <p className="overline leading-none">RutaCero</p>
                            <p className="text-sm font-semibold leading-tight">Admin</p>
                        </div>
                    </div>
                    <NotificationBell />
                </div>

                <nav className="flex-1 space-y-1 p-4">{renderNavLinks()}</nav>

                <div className="border-t border-border p-4">
                    <div className="mb-3">
                        <p className="truncate text-sm font-medium">{session.displayName || session.email}</p>
                        <p className="text-xs text-muted-foreground">{roleLabels[session.role]}</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleLogout}
                    >
                        <SignOut {...ICON} className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </div>
            </aside>
        </>
    );
}
