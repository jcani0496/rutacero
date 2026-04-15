import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 [&>svg~*]:pl-8 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-5",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        info: "bg-primary/5 text-primary border-primary/20 [&>svg]:text-primary",
        success:
          "bg-success/5 text-success border-success/20 [&>svg]:text-success",
        warning:
          "bg-warning/5 text-warning border-warning/20 [&>svg]:text-warning",
        destructive:
          "bg-destructive/5 text-destructive border-destructive/20 [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const variantIcons = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Show icon based on variant */
  showIcon?: boolean;
  /** Allow dismissing the alert */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

function Alert({
  className,
  variant = "default",
  showIcon = true,
  dismissible = false,
  onDismiss,
  children,
  ...props
}: AlertProps) {
  const Icon = variantIcons[variant || "default"];

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {showIcon && <Icon aria-hidden="true" />}
      {children}
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "absolute right-2 top-2 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
          aria-label="Cerrar alerta"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn(
        "mb-1 font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

// Inline alert for forms and smaller spaces
interface InlineAlertProps {
  variant?: "info" | "success" | "warning" | "destructive";
  children: React.ReactNode;
  className?: string;
}

function InlineAlert({
  variant = "info",
  children,
  className,
}: InlineAlertProps) {
  const Icon = variantIcons[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-sm",
        variant === "info" && "bg-primary/5 text-primary",
        variant === "success" && "bg-success/5 text-success",
        variant === "warning" && "bg-warning/5 text-warning",
        variant === "destructive" && "bg-destructive/5 text-destructive",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export { Alert, AlertTitle, AlertDescription, InlineAlert };
