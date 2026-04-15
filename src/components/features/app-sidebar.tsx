"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Wallet,
  Settings,
  HelpCircle,
  Crown,
  Target,
  Banknote,
  Bell,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

interface AppSidebarProps {
  user: User;
  isPro?: boolean;
  planCode?: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/debts", label: "Mis Deudas", icon: CreditCard },
  { href: "/finances", label: "Ingresos y Gastos", icon: Wallet },
  { href: "/payments", label: "Pagos", icon: Banknote },
  { href: "/plan", label: "Mi Plan", icon: Target },
  { href: "/forecast", label: "Predicciones", icon: TrendingUp },
];

const secondaryItems = [
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/workspaces", label: "Espacios de trabajo", icon: Layers },
  { href: "/settings", label: "Configuración", icon: Settings },
  { href: "/help", label: "Ayuda", icon: HelpCircle },
];

export function AppSidebar({ user, isPro = false, planCode = "FREE" }: AppSidebarProps) {
  const pathname = usePathname();

  // Get plan display label
  const planLabel = isPro ? (planCode === "BUSINESS" ? "Plan Business" : "Plan Pro") : "Plan Free";

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <BrandLogo height={42} priority />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn("size-5", isActive && "text-primary")}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="my-4 h-px bg-sidebar-border" />

        <div className="space-y-1">
          {secondaryItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Upgrade banner - only show for non-PRO users */}
      {!isPro && (
        <div className="p-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Crown className="size-5" aria-hidden="true" />
              <span className="font-semibold">Actualiza a Pro</span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Desbloquea exportación, más predicciones y sin límites.
            </p>
            <Button asChild className="w-full">
              <Link href="/pricing">Ver planes</Link>
            </Button>
          </div>
        </div>
      )}

      {/* User info */}
      <div className="border-t border-sidebar-border p-4">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPro && <Crown className="inline-block mr-1 size-3 text-amber-500" />}
              {planLabel}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
