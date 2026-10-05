import * as React from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

export function FormField({
  label,
  labelAction,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  /** Rendered beside the label but OUTSIDE the <label> element itself, so an
   * interactive action (e.g. "Forgot?") never gets folded into the field's
   * accessible name or the label's implicit click-to-focus behaviour. */
  labelAction?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="form-field" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-foreground">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
