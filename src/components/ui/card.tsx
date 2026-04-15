import * as React from "react";

import { cn } from "@/lib/utils";

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
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className,
  ...props
}: StatCardProps) {
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
        <span className="text-2xl font-bold tracking-tight">{value}</span>
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
