"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoneyAmount } from "@/components/money-amount";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { useCommandPalette } from "@/components/command-palette";
import { initials } from "@/lib/format";
import { addDays, formatTime, isSameDay, startOfDay, startOfWeek } from "@/lib/calendar";
import { cn } from "cn";

type Appt = {
  _id: Id<"appointments">;
  patientId: Id<"patients">;
  start: number;
  status: "booked" | "confirmed" | "arrived" | "in_progress" | "completed" | "no_show" | "cancelled";
  patientName: string;
  serviceName: string;
  serviceColour: string;
};

// Frame 13: phone widths replace the day/week calendar with a single-day
// "Today" agenda -- a date-pill week strip, two money stat tiles, and a flat
// appointment list. The bottom tab bar itself is AppShell's, not this file's.
export function MobileAgenda({
  date,
  onDateChange,
  appointments,
  onSelectAppointment,
  onNewAppointment,
}: {
  date: number;
  onDateChange: (ts: number) => void;
  appointments: Appt[];
  onSelectAppointment: (id: Id<"appointments">) => void;
  onNewAppointment: () => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const palette = useCommandPalette();
  const me = useQuery(api.users.me);
  const todayPayments = useQuery(api.billing.payments.listPaymentsTodayWithNames);
  const segmentCounts = useQuery(api.patients.patientSegmentCounts);
  const collectedToday = todayPayments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;

  const todayStart = startOfDay(date);
  const weekStart = startOfWeek(date);
  const weekdayShort = t.raw("mobile.weekdayShort") as string[];

  const sorted = [...appointments].sort((a, b) => a.start - b.start);

  return (
    <div className="flex min-h-full flex-col bg-background px-4 pt-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground capitalize">
            {new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date(todayStart))}
          </div>
          <div className="text-[28px] font-bold leading-tight">{t("today")}</div>
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

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
          const active = isSameDay(d, todayStart);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDateChange(d)}
              className={cn(
                "flex w-12 shrink-0 flex-col items-center gap-1 rounded-2xl border border-border px-1 py-2",
                active ? "bg-sidebar text-white border-sidebar" : "bg-card text-foreground",
              )}
            >
              <span className={cn("text-[11px] font-medium", active ? "text-white/70" : "text-muted-foreground")}>
                {weekdayShort[i]}
              </span>
              <span className="text-sm font-bold">{new Date(d).getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="text-xs text-muted-foreground">{t("mobile.collected")}</div>
          <MoneyAmount amount={collectedToday} className="text-lg font-bold" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="text-xs text-muted-foreground">{t("mobile.outstanding")}</div>
          <MoneyAmount amount={segmentCounts?.owesMoneyTotal ?? 0} tone="negative" className="text-lg font-bold" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pb-24">
        {sorted.map((appt) => {
          const struckThrough = appt.status === "no_show" || appt.status === "cancelled";
          return (
            <button
              key={appt._id}
              type="button"
              onClick={() => onSelectAppointment(appt._id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card py-3 pr-3 pl-0 text-left",
                appt.status === "in_progress" ? "border-status-done" : "border-border",
              )}
            >
              <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: appt.serviceColour }} />
              <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                {formatTime(appt.start, locale)}
              </span>
              <span className="min-w-0 grow">
                <span className={cn("block text-sm font-semibold", struckThrough && "text-muted-foreground line-through")}>
                  {appt.patientName}
                </span>
                <span className="block text-xs text-muted-foreground">{appt.serviceName}</span>
              </span>
              <AppointmentStatusBadge status={appt.status} />
            </button>
          );
        })}
        {sorted.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("notFoundHint")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onNewAppointment}
        className="fixed bottom-20 right-5 z-20 flex size-14 items-center justify-center rounded-2xl bg-sidebar text-white shadow-card-lg"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}
