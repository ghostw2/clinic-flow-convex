"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { cn } from "cn";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Shared by the login screen (frame 01) and the AppShell user footer
// (frame 03): a visual toggle, not a nav link -- clicking it re-navigates to
// the SAME path in the other locale via next-intl's router, preserving the
// query string so an open drawer (?date=&appt=, added in later steps)
// survives the switch. Per the user's confirmed decision, this reconciles
// CLAUDE.md Sec12's /[locale]/ requirement with the design never showing a
// URL change for this control.
// frame 01 (light login panel) and frame 03 (dark sidebar footer) style this
// control quite differently, so the theme is explicit rather than inferred.
type Theme = "light" | "dark";

const containerClass: Record<Theme, string> = {
  light: "bg-transparent",
  dark: "bg-white/5",
};

const itemClass: Record<Theme, { base: string; active: string }> = {
  light: {
    base: "text-muted-foreground",
    active: "bg-card text-foreground shadow-card-sm border border-border",
  },
  dark: {
    base: "text-sidebar-foreground/70",
    active: "bg-white/15 text-white",
  },
};

export function LanguageToggle({
  compact,
  theme = "dark",
  className,
}: {
  compact?: boolean;
  theme?: Theme;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Locale");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-md p-0.5 text-[11px] font-semibold",
        containerClass[theme],
        className,
      )}
    >
      {routing.locales.map((l) => {
        const qs = searchParams.toString();
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={active}
            onClick={() => {
              router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { locale: l });
            }}
            className={cn(
              "rounded px-2 py-1",
              active ? itemClass[theme].active : itemClass[theme].base,
            )}
          >
            {compact ? l.toUpperCase() : t(l)}
          </button>
        );
      })}
    </div>
  );
}
