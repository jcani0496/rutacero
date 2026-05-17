import * as React from "react";

import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/animated-number";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds subtle shadow elevation */
  elevated?: boolean;
  /** Interactive card with hover effect */
  interactive?: boolean;
}

function Card({
  className,
  elevated = false,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        // Base styles - RutaCero brand: white bg, subtle border, 12-16px radius
        "bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border border-border p-6 shadow-subtle",
        // Elevation
        elevated && "shadow-soft",
        // Interactive
        interactive &&
          "cursor-pointer transition-all duration-200 hover:shadow-medium hover:border-primary/20 active:scale-[0.99]",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 pt-2", className)}
      {...props}
    />
  );
}

// Stat Card for KPIs
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  /**
   * Count up from 0 to the numeric target on mount. Defaults true. Pass
   * false for non-numeric values (e.g. labels like "Sin plan") or when the
   * value should appear immediately.
   */
  animate?: boolean;
}

/**
 * Extracts a leading non-digit prefix, trailing non-digit suffix, and the
 * numeric portion from a localized currency-style string like "Q1,234.56"
 * or "Q 1.234". Returns null when no parseable number is found so the
 * caller can fall back to rendering the raw string.
 */
function parseAnimatableValue(
  raw: string | number,
): { prefix: string; suffix: string; numeric: number; fractionDigits: number } | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw)
      ? { prefix: "", suffix: "", numeric: raw, fractionDigits: 0 }
      : null;
  }
  // Match: leading non-digit prefix, a numeric body, trailing non-digit suffix.
  // The numeric body must contain at least one digit to parse.
  const match = raw.match(/^([^\d\-]*)(-?[\d.,]+)(.*)$/);
  if (!match) return null;
  const [, prefix, body, suffix] = match;
  if (!/\d/.test(body)) return null;
  // Detect decimal separator: assume the LAST non-digit char in the body that
  // is `.` or `,` is the decimal separator. The other is grouping noise.
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  let normalized = body;
  let fractionDigits = 0;
  if (lastDot === -1 && lastComma === -1) {
    normalized = body;
  } else if (lastDot > lastComma) {
    // dot is decimal
    normalized = body.replace(/,/g, "");
    const dotIdx = normalized.lastIndexOf(".");
    fractionDigits = dotIdx === -1 ? 0 : normalized.length - dotIdx - 1;
  } else {
    // comma is decimal
    normalized = body.replace(/\./g, "").replace(",", ".");
    const dotIdx = normalized.lastIndexOf(".");
    fractionDigits = dotIdx === -1 ? 0 : normalized.length - dotIdx - 1;
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return { prefix, suffix, numeric, fractionDigits };
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className,
  animate = true,
  ...props
}: StatCardProps) {
  const parsed = animate ? parseAnimatableValue(value) : null;
  return (
    <Card elevated className={cn("gap-4", className)} {...props}>
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            {icon}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-bold tracking-tight">
          {parsed ? (
            <AnimatedNumber
              value={parsed.numeric}
              prefix={parsed.prefix}
              suffix={parsed.suffix}
              fractionDigits={parsed.fractionDigits}
            />
          ) : (
            value
          )}
        </span>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-medium",
                trend.direction === "up" && "text-success",
                trend.direction === "down" && "text-destructive",
                trend.direction === "neutral" && "text-muted-foreground"
              )}
            >
              {trend.direction === "up" && "↑"}
              {trend.direction === "down" && "↓"}
              {trend.direction === "neutral" && "→"}
              {" "}
              {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
};
