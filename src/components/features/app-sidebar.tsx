"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { AppUser } from "@/lib/auth/session";
import {
  SquaresFour,
  CreditCard,
  TrendUp,
  Wallet,
  Gear,
  Question,
  Crown,
  Target,
  Money,
  Bell,
  Stack,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { getDisplayName } from "@/lib/auth/display-name";
import { ICON, type PhosphorIcon } from "@/components/icons/phosphor";

interface AppSidebarProps {
  user: AppUser;
  isPro?: boolean;
  planCode?: string;
}

const navItems: { href: string; label: string; icon: PhosphorIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/debts", label: "Mis Deudas", icon: CreditCard },
  { href: "/finances", label: "Ingresos y Gastos", icon: Wallet },
  { href: "/payments", label: "Pagos", icon: Money },
  { href: "/plan", label: "Mi Plan", icon: Target },
  { href: "/forecast", label: "Predicciones", icon: TrendUp },
];

const secondaryItems: { href: string; label: string; icon: PhosphorIcon }[] = [
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/workspaces", label: "Espacios de trabajo", icon: Stack },
  { href: "/settings", label: "Configuración", icon: Gear },
  { href: "/help", label: "Ayuda", icon: Question },
];

export function AppSidebar({ user, isPro = false, planCode = "FREE" }: AppSidebarProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const planLabel = isPro ? (planCode === "BUSINESS" ? "Plan Business" : "Plan Pro") : "Plan Free";

  const displayName = getDisplayName(user);

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <BrandLogo height={42} priority />
      </div>

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
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && reducedMotion && "bg-sidebar-accent",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && !reducedMotion && (
                  <motion.div
                    layoutId="sidebar-nav-pill"
                    className="absolute inset-0 rounded-xl bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon
                  {...ICON}
                  className={cn("relative z-10 size-5", isActive && "text-primary")}
                  aria-hidden="true"
                />
                <span className="relative z-10">{item.label}</span>
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
                <Icon {...ICON} className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {!isPro && (
        <div className="p-4">
          <div className="rounded-2xl border border-primary/20 bg-accent p-4">
            <p className="mb-1 font-semibold text-[var(--rc-teal-text)]">Actualizá a Pro</p>
            <p className="mb-3 text-sm text-muted-foreground">
              Desbloqueá exportación, más predicciones y sin límites.
            </p>
            <Button asChild className="w-full">
              <Link href="/pricing">Ver planes</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="border-t border-sidebar-border p-4">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {displayName}
            </p>
            {user.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {isPro && <Crown {...ICON} className="mr-1 inline-block size-3 text-primary" />}
              {planLabel}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
