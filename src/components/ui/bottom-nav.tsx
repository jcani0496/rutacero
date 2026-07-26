"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CreditCard,
  Target,
  TrendUp,
  User,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ICON, type PhosphorIcon } from "@/components/icons/phosphor";

interface NavItem {
  href: string;
  label: string;
  icon: PhosphorIcon;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/debts", label: "Deudas", icon: CreditCard },
  { href: "/plan", label: "Plan", icon: Target },
  { href: "/forecast", label: "Forecast", icon: TrendUp },
  { href: "/profile", label: "Perfil", icon: User },
];

interface BottomNavProps {
  className?: string;
}

function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "border-t border-border bg-card/95 backdrop-blur-lg",
        "safe-bottom",
        "md:hidden",
        className
      )}
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors touch-target",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg p-1.5 transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon {...ICON} className="size-5" aria-hidden="true" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

interface CustomBottomNavProps {
  items: NavItem[];
  className?: string;
}

function CustomBottomNav({ items, className }: CustomBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "border-t border-border bg-card/95 backdrop-blur-lg",
        "safe-bottom md:hidden",
        className
      )}
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors touch-target",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg p-1.5 transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon {...ICON} className="size-5" aria-hidden="true" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { BottomNav, CustomBottomNav };
export type { NavItem };
