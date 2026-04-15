"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, error, label, hint, leftIcon, rightIcon, id, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    // Standalone input (when used without label wrapper)
    if (!label && !hint && !error) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            ref={ref}
            data-slot="input"
            className={cn(
              // Base styles - RutaCero brand
              "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors",
              // Placeholder
              "placeholder:text-muted-foreground",
              // Focus state with brand ring
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:border-primary",
              // Disabled
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
              // Selection
              "selection:bg-primary selection:text-primary-foreground",
              // File input
              "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
              // Icon padding
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    // Full input with label/hint/error
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            ref={ref}
            data-slot="input"
            className={cn(
              // Base styles
              "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
              "selection:bg-primary selection:text-primary-foreground",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
              // Error state
              error &&
                "border-destructive focus:ring-destructive/20 focus:border-destructive",
              // Icon padding
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {rightIcon && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
