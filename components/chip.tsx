"use client";

import * as React from "react";
import { cn } from "cn";

export function Chip({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chip"
      data-active={active || undefined}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-border bg-card px-[11px] text-xs font-medium text-foreground",
        "data-[active]:border-brand-950 data-[active]:bg-brand-950 data-[active]:text-white",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      data-slot="segmented"
      role="tablist"
      className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px]", className)}
    >
      {options.map((option) => {
        const isOn = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isOn}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "shrink-0 rounded-md px-3 py-[5px] text-xs font-semibold whitespace-nowrap text-muted-foreground",
              isOn && "bg-card text-foreground shadow-card-sm",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "rounded-[5px] border border-border border-b-2 bg-card px-[5px] text-[11px] leading-[17px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
