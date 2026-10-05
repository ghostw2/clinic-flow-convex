"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslations } from "next-intl";
import {
  Activity,
  CalendarDays,
  Check,
  Circle,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Search,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageToggle } from "@/components/language-toggle";
import { useCommandPalette } from "@/components/command-palette";
import { useMediaQuery } from "@/lib/use-media-query";
import { avatarTint, initials } from "@/lib/format";
import { cn } from "cn";

const MOBILE_TAB_ITEMS = [
  { key: "tabToday", href: "/calendar", icon: CalendarDays },
  { key: "patients", href: "/patients", icon: Users },
  { key: "finances", href: "/finances", icon: Wallet },
] as const;

const NAV_ITEMS = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "patients", href: "/patients", icon: Users },
  { key: "finances", href: "/finances", icon: Wallet },
] as const;

const CLINIC_NAV_ITEMS = [
  { key: "services", href: "/settings?tab=appointments", icon: Stethoscope },
  { key: "settings", href: "/settings", icon: Settings },
] as const;

// design/png/03-dashboard.png: dark sidebar (logo, clinic switcher, nav,
// setup checklist, user + EN/SQ) + a topbar slot pages fill with their own
// page-specific header (greeting/search/actions differ per screen, so
// AppShell only owns the persistent chrome, not the topbar's contents).
export function AppShell({
  topbar,
  children,
}: {
  topbar?: ReactNode;
  children: ReactNode;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Frame 13: phone widths trade the sidebar for a bottom tab bar and drop
  // the desktop topbar entirely -- pages own their own mobile headers (the
  // calendar route's mobile agenda renders its own day strip + stat tiles).
  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <div className="flex-1 overflow-auto pb-16">{children}</div>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar && (
          <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-card px-7">
            {topbar}
          </div>
        )}
        <div className="flex-1 overflow-auto p-7">{children}</div>
      </div>
    </div>
  );
}

function MobileTabBar() {
  const t = useTranslations("AppShell");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-card">
        {MOBILE_TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                active ? "text-brand-700" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {t(item.key)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground"
        >
          <MoreHorizontal className="size-5" />
          {t("tabMore")}
        </button>
      </nav>
      {moreOpen && <MobileMoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}

function MobileMoreSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("AppShell");
  const router = useRouter();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me);

  const items = [
    { key: "dashboard", href: "/", icon: LayoutDashboard },
    { key: "services", href: "/settings?tab=appointments", icon: Stethoscope },
    { key: "settings", href: "/settings", icon: Settings },
  ] as const;

  function go(href: string) {
    router.push(href);
    onClose();
  }

  function handleSignOut() {
    // Navigate first so AppShell's queries unmount before the token is
    // revoked -- signOut-then-push leaves a round-trip where listUsers/me
    // still has a subscription open against an already-invalid session.
    onClose();
    router.push("/login");
    void signOut();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-card pb-[max(env(safe-area-inset-bottom),12px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar size="sm" className={avatarTint(me?._id ?? "me")}>
              <AvatarFallback className={avatarTint(me?._id ?? "me")}>
                {me?.name ? initials(me.name) : "…"}
              </AvatarFallback>
            </Avatar>
            <span className="text-[13.5px] font-semibold">{me?.name ?? "…"}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5 p-2">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => go(item.href)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium"
            >
              <item.icon className="size-4 text-muted-foreground" />
              {t(item.key)}
            </button>
          ))}
          <div className="flex items-center justify-end rounded-lg px-3 py-2.5">
            <LanguageToggle compact />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive"
          >
            <LogOut className="size-4" />
            {t("signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const t = useTranslations("AppShell");
  const tSetup = useTranslations("Setup");
  const pathname = usePathname();
  const palette = useCommandPalette();
  const router = useRouter();
  const { signOut } = useAuthActions();

  const clinic = useQuery(api.clinic.getClinic);
  const me = useQuery(api.users.me);
  const onboarding = useQuery(api.onboarding.onboardingStatus);
  const allUsers = useQuery(api.users.listUsers);

  // No onboardingStatus field tracks "has a second staff member" -- derived
  // here from listUsers rather than adding a backend field for it (see
  // step-1 plan's "data gaps" section).
  const hasAssistant = (allUsers ?? []).filter((u) => u.role !== undefined).length > 1;

  const setupItems = [
    { key: "clinicServices" as const, done: onboarding?.servicesSeeded ?? false },
    { key: "clinicDetails" as const, done: onboarding?.clinicExists ?? false },
    { key: "workingHours" as const, done: onboarding?.workingHoursSet ?? false },
    { key: "firstPatient" as const, done: onboarding?.hasPatient ?? false },
    { key: "inviteAssistant" as const, done: hasAssistant },
  ];
  const doneCount = setupItems.filter((item) => item.done).length;
  const setupComplete = doneCount === setupItems.length;

  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-1 bg-sidebar px-3 py-4 text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-2 pt-1 pb-3.5 text-[17px] font-bold tracking-tight text-white">
        <div className="flex size-[30px] items-center justify-center rounded-[9px] bg-brand-300 text-brand-950">
          <Activity className="size-[18px]" strokeWidth={2.4} />
        </div>
        ClinicFlow
      </div>

      <div className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2.5">
        <Avatar size="sm" className={avatarTint(clinic?._id ?? "clinic")}>
          <AvatarFallback className={avatarTint(clinic?._id ?? "clinic")}>
            {clinic ? initials(clinic.name) : "…"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 grow">
          <div className="truncate text-[13px] font-semibold text-white">
            {clinic?.name ?? "…"}
          </div>
          <div className="truncate text-[11.5px] text-sidebar-foreground/60">
            {me?.role === "owner"
              ? t("roleOwner")
              : me?.role === "assistant"
                ? t("roleAssistant")
                : "…"}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => palette.open()}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-sidebar-foreground/70"
      >
        <Search className="size-4" />
        {t("search")}
        <kbd className="ml-auto rounded-[5px] border border-white/10 bg-white/5 px-[5px] text-[11px] font-semibold text-sidebar-foreground/60">
          ⌘K
        </kbd>
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground",
                active && "bg-sidebar-accent text-white",
              )}
            >
              <Icon
                className={cn("size-4", active ? "text-brand-300" : "text-sidebar-foreground/60")}
              />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-sidebar-foreground/50 uppercase">
        {t("clinicSection")}
      </div>
      <nav className="flex flex-col gap-0.5">
        {CLINIC_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground",
                active && "bg-sidebar-accent text-white",
              )}
            >
              <Icon
                className={cn("size-4", active ? "text-brand-300" : "text-sidebar-foreground/60")}
              />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {onboarding && !setupComplete && (
        <div className="mb-1 rounded-lg border border-brand-300/20 bg-brand-300/10 px-3 py-2.5">
          <div className="text-[12.5px] font-semibold text-white">{tSetup("title")}</div>
          <div className="my-2 h-[5px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-brand-300"
              style={{ width: `${(doneCount / setupItems.length) * 100}%` }}
            />
          </div>
          <ul className="flex flex-col gap-1">
            {setupItems.map((item) => (
              <li
                key={item.key}
                className={cn(
                  "flex items-center gap-1.5 text-[12px]",
                  item.done ? "text-sidebar-foreground/50 line-through" : "text-sidebar-foreground",
                )}
              >
                {item.done ? (
                  <Check className="size-3 text-brand-300" />
                ) : (
                  <Circle className="size-3 text-sidebar-foreground/30" />
                )}
                {tSetup(item.key)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2.5 border-t border-white/10 pt-2.5">
        <Avatar size="sm" className={avatarTint(me?._id ?? "me")}>
          <AvatarFallback className={avatarTint(me?._id ?? "me")}>
            {me?.name ? initials(me.name) : "…"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 grow">
          <div className="truncate text-[13px] font-semibold text-white">{me?.name ?? "…"}</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">{me?.email ?? ""}</div>
        </div>
        <LanguageToggle compact theme="dark" />
        <button
          type="button"
          onClick={() => {
            router.push("/login");
            void signOut();
          }}
          aria-label={t("signOut")}
          title={t("signOut")}
          className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
