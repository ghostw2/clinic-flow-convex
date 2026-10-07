"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Stethoscope, UserRoundPlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatTile } from "@/components/stat-tile";
import { MoneyAmount } from "@/components/money-amount";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { NewAppointmentDrawer } from "@/components/calendar/new-appointment-drawer";
import { avatarTint, initials } from "@/lib/format";
import { addDays, formatDayHeading, startOfDay } from "@/lib/calendar";
import { useCommandPalette } from "@/components/command-palette";
import { useMediaQuery } from "@/lib/use-media-query";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const router = useRouter();
  const palette = useCommandPalette();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [newDrawer, setNewDrawer] = React.useState<"appointment" | "walkIn" | null>(null);

  const [now] = React.useState(() => Date.now());
  const todayStart = React.useMemo(() => startOfDay(now), [now]);
  const todayEnd = React.useMemo(() => addDays(todayStart, 1), [todayStart]);
  const weekStart = React.useMemo(() => addDays(todayStart, -todayDay(todayStart)), [todayStart]);
  const weekEnd = React.useMemo(() => addDays(weekStart, 7), [weekStart]);

  const onboardingStatus = useQuery(api.onboarding.onboardingStatus);
  React.useEffect(() => {
    if (onboardingStatus && !onboardingStatus.clinicExists) {
      router.replace("/onboarding");
    }
  }, [onboardingStatus, router]);

  const me = useQuery(api.users.me);
  const allUsers = useQuery(api.users.listUsers);
  const practitioners = React.useMemo(() => (allUsers ?? []).filter((u) => u.isPractitioner), [allUsers]);
  const todayAppts = useQuery(api.appointments.listAppointmentsByDay, { dayStart: todayStart, dayEnd: todayEnd });
  const weekAppts = useQuery(api.appointments.listAppointmentsByWeek, { weekStart, weekEnd });
  const todayPayments = useQuery(api.billing.payments.listPaymentsTodayWithNames);
  const segmentCounts = useQuery(api.patients.patientSegmentCounts);
  const topDebtors = useQuery(api.patients.listTopDebtors, { limit: 5 });
  const overdueInstallments = useQuery(api.billing.paymentPlans.listOverdueInstallmentsWithNames);

  const collectedToday = todayPayments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const noShowsThisWeek = weekAppts?.filter((a) => a.status === "no_show") ?? [];
  const sortedToday = [...(todayAppts ?? [])].sort((a, b) => a.start - b.start);
  const arrivalsPending = todayAppts?.filter((a) => a.status === "arrived") ?? [];
  const overdueTotal = overdueInstallments?.reduce((sum, i) => sum + i.amount, 0) ?? 0;

  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodAfternoon") : t("goodEvening");
  const firstName = me?.name?.split(" ")[0] ?? "";

  return (
    <AppShell
      topbar={
        <>
          <h1 className="text-[18px] font-semibold tracking-tight">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="grow" />
          <button
            type="button"
            onClick={() => palette.open()}
            className="flex h-9 w-[300px] items-center gap-2 rounded-lg bg-muted px-3 text-sm text-muted-foreground"
          >
            <Search className="size-4" />
            <span className="grow text-left">{t("searchPlaceholder")}</span>
            <kbd className="rounded border border-border bg-card px-1 text-[11px] font-semibold">⌘K</kbd>
          </button>
          <Button variant="outline" onClick={() => setNewDrawer("walkIn")}>
            <Stethoscope className="size-4" /> {t("walkIn")}
          </Button>
          <Button onClick={() => setNewDrawer("appointment")}>
            <UserRoundPlus className="size-4" /> {t("newAppointment")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {isMobile ? (
          <div className="flex items-start justify-between px-4 pt-4">
            <div>
              <div className="text-xs text-muted-foreground capitalize">
                {formatDayHeading(todayStart, locale)}
              </div>
              <div className="text-[22px] font-bold leading-tight">
                {greeting}
                {firstName ? `, ${firstName}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => palette.open()}
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card"
              >
                <Search className="size-4 text-muted-foreground" />
              </button>
              <Avatar size="sm">
                <AvatarFallback>{me?.name ? initials(me.name) : "…"}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-sm text-muted-foreground capitalize">{formatDayHeading(todayStart, locale)}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label={t("appointmentsToday")} value={todayAppts?.length ?? "…"} />
          <StatTile label={t("arrivalsPending")} value={arrivalsPending.length} />
          <StatTile label={t("collectedToday")} value={<MoneyAmount amount={collectedToday} tone="positive" />} />
          <StatTile
            label={t("outstandingBalance")}
            value={<MoneyAmount amount={segmentCounts?.owesMoneyTotal ?? 0} tone="negative" />}
          />
          <StatTile
            label={t("overdueInstallments")}
            value={<MoneyAmount amount={overdueTotal} tone={overdueTotal > 0 ? "negative" : "muted"} />}
          />
          <StatTile label={t("noShowsThisWeek")} value={noShowsThisWeek.length} />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_360px] items-start">
          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
              <h3 className="text-[14.5px] font-semibold">{t("todaysSchedule")}</h3>
              <button
                type="button"
                onClick={() => router.push("/calendar")}
                className="text-xs font-semibold text-primary"
              >
                {t("openCalendar")}
              </button>
            </div>
            {sortedToday.length === 0 ? (
              <p className="p-[18px] text-sm text-muted-foreground">{t("noAppointmentsToday")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {sortedToday.map((appt) => (
                  <li key={appt._id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/calendar?appt=${appt._id}`)}
                      className="flex w-full items-center gap-3 px-[18px] py-3 text-left hover:bg-muted/40"
                    >
                      <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                        {new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(new Date(appt.start))}
                      </span>
                      <Avatar size="sm" className={avatarTint(appt.patientId)}>
                        <AvatarFallback className={avatarTint(appt.patientId)}>
                          {initials(appt.patientName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="grow">
                        <span className="block text-sm font-semibold">{appt.patientName}</span>
                        <span className="block text-xs text-muted-foreground">{appt.serviceName}</span>
                      </span>
                      <AppointmentStatusBadge status={appt.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
              <h3 className="text-[14.5px] font-semibold">{t("owedToYou")}</h3>
              <button
                type="button"
                onClick={() => router.push("/patients")}
                className="text-xs font-semibold text-primary"
              >
                {t("all")}
              </button>
            </div>
            {!topDebtors || topDebtors.length === 0 ? (
              <p className="p-[18px] text-sm text-muted-foreground">{t("noOutstanding")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {topDebtors.map((p) => (
                  <li key={p._id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/patients/${p._id}`)}
                      className="flex w-full items-center gap-2.5 px-[18px] py-3 text-left hover:bg-muted/40"
                    >
                      <Avatar size="sm" className={avatarTint(p._id)}>
                        <AvatarFallback className={avatarTint(p._id)}>
                          {initials(`${p.firstName} ${p.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="grow text-sm font-semibold">
                        {p.firstName} {p.lastName}
                      </span>
                      <MoneyAmount amount={p.balance} tone="negative" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {newDrawer && (
        <NewAppointmentDrawer
          open
          onOpenChange={(o) => !o && setNewDrawer(null)}
          mode={newDrawer}
          practitioners={practitioners}
          defaultStart={now}
        />
      )}
    </AppShell>
  );
}

function todayDay(ts: number): number {
  return new Date(ts).getDay();
}
