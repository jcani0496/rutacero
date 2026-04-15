"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Currency = "GTQ" | "USD";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: number;
  onChange?: (value: number | undefined) => void;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  allowCurrencySwitch?: boolean;
  label?: string;
  error?: string;
  hint?: string;
}

const currencyConfig: Record<Currency, { symbol: string; locale: string }> = {
  GTQ: { symbol: "Q", locale: "es-GT" },
  USD: { symbol: "$", locale: "en-US" },
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      value,
      onChange,
      currency = "GTQ",
      onCurrencyChange,
      allowCurrencySwitch = false,
      label,
      error,
      hint,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    // Format number for display
    const formatValue = React.useCallback((num: number | undefined): string => {
      if (num === undefined || isNaN(num)) return "";
      return num.toLocaleString(currencyConfig[currency].locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }, [currency]);

    // Parse input string to number
    const parseValue = (str: string): number | undefined => {
      const cleaned = str.replace(/[^0-9.-]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    };

    const [displayValue, setDisplayValue] = React.useState(() =>
      formatValue(value)
    );
    const [isFocused, setIsFocused] = React.useState(false);

    // Update display when external value changes
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatValue(value));
      }
    }, [value, isFocused, formatValue]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Show raw number on focus
      if (value !== undefined) {
        setDisplayValue(value.toFixed(2));
      }
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Format on blur
      const parsed = parseValue(displayValue);
      if (parsed !== undefined) {
        setDisplayValue(formatValue(parsed));
        onChange?.(parsed);
      } else {
        setDisplayValue("");
        onChange?.(undefined);
      }
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // Only allow numbers, dots, and commas
      if (/^[0-9.,]*$/.test(newValue) || newValue === "") {
        setDisplayValue(newValue);
        const parsed = parseValue(newValue);
        onChange?.(parsed);
      }
    };

    const handleCurrencyToggle = () => {
      if (!allowCurrencySwitch || disabled) return;
      const newCurrency = currency === "GTQ" ? "USD" : "GTQ";
      onCurrencyChange?.(newCurrency);
    };

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
          {/* Currency Symbol/Toggle */}
          <button
            type="button"
            onClick={handleCurrencyToggle}
            disabled={!allowCurrencySwitch || disabled}
            className={cn(
              "absolute left-0 top-0 flex h-full items-center justify-center rounded-l-xl border-r border-input bg-muted px-3 text-sm font-medium text-muted-foreground",
              allowCurrencySwitch &&
                !disabled &&
                "cursor-pointer hover:bg-muted/80 transition-colors",
              !allowCurrencySwitch && "cursor-default"
            )}
            tabIndex={allowCurrencySwitch ? 0 : -1}
            aria-label={
              allowCurrencySwitch
                ? `Cambiar moneda. Actual: ${currency}`
                : `Moneda: ${currency}`
            }
          >
            {currencyConfig[currency].symbol}
          </button>

          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            id={inputId}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            className={cn(
              // Base styles
              "flex h-10 w-full rounded-xl border border-input bg-background py-2 pr-3 text-sm text-foreground transition-colors",
              // Padding for currency symbol
              "pl-14",
              // Placeholder
              "placeholder:text-muted-foreground",
              // Focus
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:border-primary",
              // Disabled
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
              // Error
              error &&
                "border-destructive focus:ring-destructive/20 focus:border-destructive",
              // Right align numbers
              "text-right",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
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

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
export type { CurrencyInputProps, Currency };
