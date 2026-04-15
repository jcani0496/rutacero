import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        outline: "text-foreground border-border",
        // Risk level badges for debt management
        "risk-low": "border-success/20 bg-success/10 text-success",
        "risk-medium": "border-warning/20 bg-warning/10 text-warning",
        "risk-high": "border-destructive/20 bg-destructive/10 text-destructive",
        // Status badges
        active: "border-primary/20 bg-primary/10 text-primary",
        inactive: "border-muted-foreground/20 bg-muted text-muted-foreground",
        // Subscription status
        trial: "border-primary/20 bg-primary/10 text-primary",
        "past-due": "border-destructive/20 bg-destructive/10 text-destructive",
        canceled: "border-muted-foreground/20 bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional dot indicator before text */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "mr-1.5 size-1.5 rounded-full",
            variant === "risk-low" || variant === "success"
              ? "bg-success"
              : variant === "risk-medium" || variant === "warning"
              ? "bg-warning"
              : variant === "risk-high" ||
                variant === "destructive" ||
                variant === "past-due"
              ? "bg-destructive"
              : variant === "active" || variant === "trial"
              ? "bg-primary"
              : "bg-muted-foreground"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
