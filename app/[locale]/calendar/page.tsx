"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Stethoscope, UserRoundPlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/chip";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { AppointmentPanel } from "@/components/calendar/appointment-panel";
import { NewAppointmentDrawer } from "@/components/calendar/new-appointment-drawer";
import { TabletVisitMode } from "@/components/calendar/tablet-visit-mode";
import { MobileAgenda } from "@/components/calendar/mobile-agenda";
import { MobileChargeSheet } from "@/components/calendar/mobile-charge-sheet";
import { WeekView } from "@/components/calendar/week-view";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  addDays,
  dateParamToTimestamp,
  startOfDay,
  startOfWeek,
  timestampToDateParam,
} from "@/lib/calendar";

export default function CalendarPage() {
  const t = useTranslations("Calendar");
  const router = useRouter();
  const searchParams = useSearchParams();

  const date = dateParamToTimestamp(searchParams.get("date"));
  const appointmentId = searchParams.get("appt") as Id<"appointments"> | null;
  const [view, setView] = React.useState<"day" | "week">("day");
  const [newDrawer, setNewDrawer] = React.useState<"appointment" | "walkIn" | null>(null);
  const [now] = React.useState(() => Date.now());

  function pushParams(next: { date?: number; appt?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.date !== undefined) params.set("date", timestampToDateParam(next.date));
    if (next.appt !== undefined) {
      if (next.appt === null) params.delete("appt");
      else params.set("appt", next.appt);
    }
    router.push(`/calendar?${params.toString()}`);
  }

  const allUsers = useQuery(api.users.listUsers);
  const practitioners = React.useMemo(
    () => (allUsers ?? []).filter((u) => u.isPractitioner),
    [allUsers],
  );
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const appointments = useQuery(api.appointments.listAppointmentsByDay, { dayStart, dayEnd });

  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 7);
  const weekAppointments = useQuery(
    api.appointments.listAppointmentsByWeek,
    view === "week" ? { weekStart, weekEnd } : "skip",
  );

  const [dragError, setDragError] = React.useState<string | null>(null);
  const reschedule = useMutation(api.appointments.rescheduleAppointment).withOptimisticUpdate(
    (localStore, args) => {
      const existing = localStore.getQuery(api.appointments.listAppointmentsByDay, { dayStart, dayEnd });
      if (existing === undefined) return;
      const practitionerName = args.practitionerId
        ? (practitioners.find((p) => p._id === args.practitionerId)?.name ?? undefined)
        : undefined;
      localStore.setQuery(
        api.appointments.listAppointmentsByDay,
        { dayStart, dayEnd },
        existing.map((a) =>
          a._id === args.appointmentId
            ? {
                ...a,
                start: args.start,
                end: args.end,
                ...(args.practitionerId ? { practitionerId: args.practitionerId } : {}),
                ...(practitionerName ? { practitionerName } : {}),
              }
            : a,
        ),
      );
    },
  );

  async function handleReschedule(args: {
    appointmentId: string;
    start: number;
    end: number;
    practitionerId?: string;
  }) {
    try {
      await reschedule({
        appointmentId: args.appointmentId as Id<"appointments">,
        start: args.start,
        end: args.end,
        practitionerId: args.practitionerId as Id<"users"> | undefined,
      });
    } catch (err) {
      setDragError(err instanceof ConvexError ? String(err.data) : t("rescheduleError"));
      setTimeout(() => setDragError(null), 4000);
    }
  }

  const isTablet = useMediaQuery("(max-width: 1279px)");
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Frames 12-14: below 1280px the day/week grid gives way to bespoke
  // layouts (tablet visit mode's icon rail + list + detail; the phone
  // agenda + charge sheet), not a responsive reflow of CalendarGrid.
  if (isTablet) {
    if (appointments === undefined || practitioners.length === 0) {
      return <div className="flex h-dvh animate-pulse bg-muted" />;
    }
    if (isMobile) {
      return (
        <AppShell>
          <MobileAgenda
            date={date}
            onDateChange={(d) => pushParams({ date: d })}
            appointments={appointments}
            onSelectAppointment={(id) => pushParams({ appt: id })}
            onNewAppointment={() => setNewDrawer("appointment")}
          />
          {appointmentId && (
            <MobileChargeSheet appointmentId={appointmentId} onClose={() => pushParams({ appt: null })} />
          )}
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
    return (
      <>
        <TabletVisitMode
          date={date}
          appointments={appointments}
          selectedAppointmentId={appointmentId}
          onSelectAppointment={(id) => pushParams({ appt: id })}
          onWalkIn={() => setNewDrawer("walkIn")}
          onNewAppointment={() => setNewDrawer("appointment")}
        />
        {newDrawer && (
          <NewAppointmentDrawer
            open
            onOpenChange={(o) => !o && setNewDrawer(null)}
            mode={newDrawer}
            practitioners={practitioners}
            defaultStart={now}
          />
        )}
      </>
    );
  }

  return (
    <AppShell
      topbar={
        <>
          <h1 className="text-[18px] font-semibold tracking-tight">{t("title")}</h1>
          <div className="grow" />
          <Segmented
            value={view}
            onValueChange={setView}
            options={[
              { value: "day", label: t("day") },
              { value: "week", label: t("week") },
            ]}
          />
          <Button variant="outline" onClick={() => setNewDrawer("walkIn")}>
            <Stethoscope className="size-4" /> {t("walkIn")}
          </Button>
          <Button onClick={() => setNewDrawer("appointment")}>
            <UserRoundPlus className="size-4" /> {t("newAppointment")}
          </Button>
        </>
      }
    >
      {view === "week" ? (
        weekAppointments === undefined ? (
          <div className="h-full animate-pulse rounded-[14px] bg-muted" />
        ) : (
          <WeekView
            weekStart={weekStart}
            appointments={weekAppointments}
            selectedAppointmentId={appointmentId}
            onSelectDay={(d) => {
              setView("day");
              pushParams({ date: d });
            }}
            onSelectAppointment={(id) => pushParams({ appt: id })}
          />
        )
      ) : practitioners.length === 0 || appointments === undefined ? (
        <div className="h-full animate-pulse rounded-[14px] bg-muted" />
      ) : (
        <CalendarGrid
          date={date}
          practitioners={practitioners}
          appointments={appointments}
          selectedAppointmentId={appointmentId}
          onDateChange={(d) => pushParams({ date: d })}
          onSelectAppointment={(id) => pushParams({ appt: id })}
          onReschedule={handleReschedule}
        />
      )}

      {dragError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-status-cancel-bg px-4 py-2.5 text-sm font-semibold text-status-cancel shadow-card-lg">
          {dragError}
        </div>
      )}

      {appointmentId && (
        <AppointmentPanel appointmentId={appointmentId} onClose={() => pushParams({ appt: null })} />
      )}

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
