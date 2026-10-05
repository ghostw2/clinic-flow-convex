"use client";

import * as React from "react";
import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";

// design/IMPLEMENTATION_BRIEF.md / frame 15 "EntityDrawer anatomy":
//   Docked (calendar, >=1280px): 404px, calendar stays visible.
//   Overlay (<1280px): slides over with scrim.
//   Sheet (mobile): bottom sheet, same content.
//   States are steps in one drawer (detail -> charge -> receipt), never a
//   new page.
// Docked mode renders the same fixed-right panel as overlay, just without a
// dimming backdrop -- true CSS-grid reflow belongs to whichever page lays
// out a docked calendar next to it (step 4), not to this shared primitive.
export function EntityDrawer({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isDocked = useMediaQuery("(min-width: 1280px)");
  const side: "bottom" | "right" = isMobile ? "bottom" : "right";

  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Portal>
        {!isDocked && (
          <DrawerPrimitive.Backdrop
            data-slot="entity-drawer-scrim"
            className="fixed inset-0 z-50 bg-[#0E231F]/38 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
          />
        )}
        <DrawerPrimitive.Popup
          data-slot="entity-drawer"
          className={cn(
            "fixed z-50 flex flex-col border-border bg-card shadow-card-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
            side === "bottom" &&
              "inset-x-0 bottom-0 max-h-[85vh] rounded-t-sheet border-t data-ending-style:translate-y-8 data-starting-style:translate-y-8",
            side === "right" &&
              "inset-y-0 right-0 h-full w-full max-w-[404px] border-l data-ending-style:translate-x-8 data-starting-style:translate-x-8",
            className,
          )}
        >
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

function Header({
  avatar,
  title,
  subtitle,
  onClose,
}: {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
      {avatar}
      <div className="min-w-0 grow">
        <div className="truncate text-sm font-bold">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {onClose && (
        <DrawerPrimitive.Close
          render={<Button variant="ghost" size="icon-sm" />}
          onClick={onClose}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DrawerPrimitive.Close>
      )}
    </div>
  );
}

/** Progress dots for a multi-step drawer flow (detail -> charge -> receipt). */
function Steps({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex gap-1.5 border-b border-border px-4 py-2.5">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn("h-1 flex-1 rounded-full", i <= current ? "bg-brand-500" : "bg-muted")}
        />
      ))}
    </div>
  );
}

function Body({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-slot="entity-drawer-body" className={cn("flex-1 overflow-y-auto p-4", className)}>
      {children}
    </div>
  );
}

function Footer({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      data-slot="entity-drawer-footer"
      className={cn("mt-auto flex items-center gap-2.5 border-t border-border bg-[#FBFCFB] p-3.5", className)}
    >
      {children}
    </div>
  );
}

EntityDrawer.Header = Header;
EntityDrawer.Steps = Steps;
EntityDrawer.Body = Body;
EntityDrawer.Footer = Footer;
