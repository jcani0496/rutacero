'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { UserNotificationBell } from '@/components/notifications/user-notification-bell';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    Menu,
    User as UserIcon,
    Settings,
    LogOut,
    Wallet,
    LayoutDashboard,
    CreditCard,
    Calendar,
    TrendingUp,
} from 'lucide-react';
import type { UserNotification } from '@/lib/actions/user-notifications';

interface AppHeaderProps {
    user: User;
    initialNotifications?: UserNotification[];
    initialUnreadCount?: number;
}

const mobileNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/debts', label: 'Mis Deudas', icon: CreditCard },
    { href: '/finances', label: 'Finanzas', icon: Wallet },
    { href: '/plan', label: 'Mi Plan', icon: Calendar },
    { href: '/forecast', label: 'Predicciones', icon: TrendingUp },
];

export function AppHeader({ user, initialNotifications = [], initialUnreadCount = 0 }: AppHeaderProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-xl px-4 shadow-subtle lg:px-8">
            {/* Mobile menu button */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-card border-border p-0">
                    <div className="flex h-16 items-center border-b border-border px-6">
                        <BrandLogo height={40} />
                    </div>
                    <nav className="space-y-1 p-4">
                        {mobileNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </SheetContent>
            </Sheet>

            {/* Page title - could be dynamic */}
            <div className="flex-1">
                {/* Placeholder for breadcrumb or title */}
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <UserNotificationBell
                    userId={user.id}
                    initialNotifications={initialNotifications}
                    initialUnreadCount={initialUnreadCount}
                />

                {/* User menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                            <span className="hidden md:inline-block max-w-[150px] truncate">
                                {user.email}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                        <div className="px-2 py-1.5">
                            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                            <p className="text-xs text-muted-foreground">Plan Free</p>
                        </div>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem asChild>
                            <Link href="/profile" className="flex items-center gap-2 text-foreground hover:text-foreground cursor-pointer">
                                <UserIcon className="h-4 w-4" />
                                Mi Perfil
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/settings" className="flex items-center gap-2 text-foreground hover:text-foreground cursor-pointer">
                                <Settings className="h-4 w-4" />
                                Configuración
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-destructive hover:text-destructive cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                            Cerrar sesión
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
