"use client"

import * as React from "react"
import {
    Check
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

import { cn } from "@/lib/utils"

/**
 * Minimal accessible checkbox built on a native <input type="checkbox">.
 * The native input is visually hidden but remains focusable so screen
 * readers and keyboard users get standard semantics. The styled box
 * tracks the input's `:checked` / `:focus-visible` state via the
 * `peer-*` utilities.
 */
export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
    containerClassName?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, containerClassName, checked, ...props }, ref) => {
        return (
            <span
                className={cn(
                    "relative inline-flex h-4 w-4 shrink-0 items-center justify-center",
                    containerClassName,
                )}
            >
                <input
                    ref={ref}
                    type="checkbox"
                    checked={checked}
                    className={cn(
                        "peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[4px] border border-slate-300 bg-white",
                        "checked:border-emerald-500 checked:bg-emerald-500",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                    {...props}
                />
                <Check
                    {...ICON}
                    aria-hidden="true"
                    className="pointer-events-none h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
                />
            </span>
        )
    },
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
