"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Doc } from "@/convex/_generated/dataModel";
import { addDays, formatTime, isSameDay } from "@/lib/calendar";
import { cn } from "cn";

type Appointment = Doc<"appointments">;

// Week view (spec Sec6) is an overview, not a second place to drag/resize --
// day view already owns that interaction at a width where it's actually
// precise. Clicking a day header jumps into day view for that date; clicking
// an appointment opens the same AppointmentPanel as day view.
export function WeekView({
  weekStart,
  appointments,
  selectedAppointmentId,
  onSelectDay,
  onSelectAppointment,
}: {
  weekStart: number;
  appointments: Appointment[];
  selectedAppointmentId: string | null;
  onSelectDay: (date: number) => void;
  onSelectAppointment: (id: string) => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const [now] = React.useState(() => Date.now());

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = React.useMemo(() => {
    const map = new Map<number, Appointment[]>();
    for (const day of days) map.set(day, []);
    for (const appt of appointments) {
      const day = days.find((d) => isSameDay(d, appt.start));
      if (day !== undefined) map.get(day)!.push(appt);
    }
    for (const list of map.values()) list.sort((a, b) => a.start - b.start);
    return map;
  }, [appointments, days]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="grid flex-1 grid-cols-7 divide-x divide-border overflow-hidden">
        {days.map((day) => {
          const isToday = isSameDay(day, now);
          const appts = byDay.get(day) ?? [];
          return (
            <div key={day} className="flex min-w-0 flex-col">
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-0.5 border-b border-border px-2 py-2.5 text-center",
                  isToday && "bg-brand-50",
                )}
              >
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", { weekday: "short" }).format(day)}
                </span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[13px] font-bold",
                    isToday && "bg-brand-700 text-white",
                  )}
                >
                  {new Date(day).getDate()}
                </span>
              </button>
              <div className="flex-1 overflow-y-auto px-1 py-1">
                {appts.length === 0 ? (
                  <div className="py-3 text-center text-[11px] text-muted-foreground">{t("apptCount", { count: 0 })}</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {appts.map((appt) => (
                      <button
                        key={appt._id}
                        type="button"
                        onClick={() => onSelectAppointment(appt._id)}
                        className={cn(
                          "flex items-start gap-1.5 rounded-md border px-1.5 py-1 text-left",
                          appt._id === selectedAppointmentId
                            ? "border-brand-700 bg-brand-50"
                            : "border-transparent hover:bg-muted/60",
                        )}
                        style={{
                          backgroundColor:
                            appt._id === selectedAppointmentId
                              ? undefined
                              : `color-mix(in srgb, ${appt.serviceColour} 10%, white)`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 h-full w-1 shrink-0 self-stretch rounded-full"
                          style={{ backgroundColor: appt.serviceColour }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-semibold tabular-nums text-muted-foreground">
                            {formatTime(appt.start, locale)}
                          </span>
                          <span className="block truncate text-[12px] font-semibold text-foreground">
                            {appt.patientName}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
