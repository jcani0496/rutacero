"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import {
    Calendar
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  id?: string;
}

function DatePicker({
  value,
  onChange,
  label,
  error,
  hint,
  placeholder = "Seleccionar fecha",
  disabled,
  minDate,
  maxDate,
  className,
  id,
}: DatePickerProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Internal state for the text input
  const [inputValue, setInputValue] = React.useState(() =>
    value && isValid(value) ? format(value, "dd/MM/yyyy") : ""
  );

  // Sync with external value
  React.useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy"));
    } else if (!value) {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse the date
    if (newValue.length === 10) {
      const parsed = parse(newValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        // Check min/max constraints
        if (minDate && parsed < minDate) return;
        if (maxDate && parsed > maxDate) return;
        onChange?.(parsed);
      }
    } else if (newValue === "") {
      onChange?.(undefined);
    }
  };

  const handleBlur = () => {
    // Re-format on blur if we have a valid value
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy"));
    } else if (inputValue && inputValue.length > 0) {
      // Try to parse what was entered
      const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange?.(parsed);
        setInputValue(format(parsed, "dd/MM/yyyy"));
      } else {
        // Invalid input - clear it
        setInputValue("");
        onChange?.(undefined);
      }
    }
  };

  const handleCalendarClick = () => {
    // In a real implementation, this would open a calendar popover
    // For now, we focus the input
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          id={inputId}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            // Base styles
            "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors",
            // Padding for icon
            "pr-10",
            // Placeholder
            "placeholder:text-muted-foreground",
            // Focus
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:border-primary",
            // Disabled
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
            // Error
            error &&
              "border-destructive focus:ring-destructive/20 focus:border-destructive"
          )}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCalendarClick}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2"
          aria-label="Abrir calendario"
        >
          <Calendar {...ICON} className="size-4 text-muted-foreground" />
        </Button>
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

      {/* Format hint */}
      {!error && !hint && (
        <p className="text-xs text-muted-foreground">Formato: DD/MM/AAAA</p>
      )}
    </div>
  );
}

export { DatePicker };
export type { DatePickerProps };
