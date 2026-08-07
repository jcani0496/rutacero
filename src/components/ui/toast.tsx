"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import {
    CheckCircle,
    CircleNotch,
    Info,
    Warning,
    WarningCircle
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

import { cn } from "@/lib/utils";

// Custom Toaster with RutaCero styling
function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      expand={false}
      richColors={false}
      closeButton
      offset={24}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            // `rc-portal`: sonner mounts in <body>, outside the paper wrappers.
            "rc-portal group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-foreground shadow-[0_18px_40px_-20px_rgba(27,24,18,0.28)]",
            "data-[type=success]:border-success/20 data-[type=success]:bg-success/5",
            "data-[type=error]:border-destructive/20 data-[type=error]:bg-destructive/5",
            "data-[type=warning]:border-warning/20 data-[type=warning]:bg-warning/5",
            "data-[type=info]:border-primary/20 data-[type=info]:bg-primary/5"
          ),
          title: "text-sm font-semibold text-foreground",
          description: "text-sm text-muted-foreground",
          actionButton:
            "inline-flex items-center justify-center rounded-lg bg-primary-strong px-3 py-1.5 text-xs font-medium text-primary-strong-foreground hover:bg-primary-strong/90",
          cancelButton:
            "inline-flex items-center justify-center rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80",
          closeButton:
            "absolute right-2 top-2 rounded-lg p-1 text-muted-foreground opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring",
        },
      }}
    />
  );
}

// Toast helper functions with RutaCero styling
interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const toast = {
  // Success toast
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      ...options,
      icon: <CheckCircle className="size-5 text-success" />,
    });
  },

  // Error toast
  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      ...options,
      icon: <WarningCircle className="size-5 text-destructive" />,
    });
  },

  // Warning toast
  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      ...options,
      icon: <Warning className="size-5 text-warning" />,
    });
  },

  // Info toast
  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      ...options,
      icon: <Info className="size-5 text-primary" />,
    });
  },

  // Loading toast
  loading: (message: string, options?: Omit<ToastOptions, "action">) => {
    return sonnerToast.loading(message, {
      ...options,
      icon: <CircleNotch {...ICON} className="size-5 animate-spin text-primary" />,
    });
  },

  // Promise toast (for async operations)
  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
    });
  },

  // Dismiss toast
  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },
};

export { Toaster, toast };
