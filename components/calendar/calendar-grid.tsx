"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, UserRoundX } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Segmented } from "@/components/chip";
import { avatarTint, initials } from "@/lib/format";
import {
  DAY_END_MIN,
  DAY_START_MIN,
  GRID_HEIGHT,
  addDays,
  durationToHeight,
  formatDayHeading,
  formatHour,
  isSameDay,
  minutesFromMidnight,
  minutesToY,
  PX_PER_MIN,
  snapMinutes,
  startOfDay,
  timeToY,
} from "@/lib/calendar";

const MIN_DURATION_MIN = 15;
const DRAG_THRESHOLD_PX = 4;

type DragMode = "move" | "resize";

type DragState = {
  appointmentId: string;
  mode: DragMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originalStart: number;
  originalEnd: number;
  originalPractitionerId: string;
  dragging: boolean; // past the movement threshold -- distinguishes a drag from a click
  previewStart: number;
  previewEnd: number;
  previewPractitionerId: string;
};

type Appointment = Doc<"appointments">;
type ColourBy = "service" | "status";

const STATUS_COLOUR: Record<Appointment["status"], string> = {
  booked: "var(--color-status-booked)",
  confirmed: "var(--color-status-booked)",
  arrived: "var(--color-status-arrived)",
  in_progress: "var(--color-status-progress)",
  completed: "var(--color-status-done)",
  no_show: "var(--color-status-noshow)",
  cancelled: "var(--color-status-cancel)",
};

export function CalendarGrid({
  date,
  practitioners,
  appointments,
  selectedAppointmentId,
  onDateChange,
  onSelectAppointment,
  onReschedule,
}: {
  date: number;
  practitioners: Doc<"users">[];
  appointments: Appointment[];
  selectedAppointmentId: string | null;
  onDateChange: (date: number) => void;
  onSelectAppointment: (id: string) => void;
  onReschedule: (args: {
    appointmentId: string;
    start: number;
    end: number;
    practitionerId?: string;
  }) => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const [colourBy, setColourBy] = React.useState<ColourBy>("service");
  const [now] = React.useState(() => Date.now());
  const isToday = isSameDay(date, now);

  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const gridBodyRef = React.useRef<HTMLDivElement | null>(null);
  const columnRefs = React.useRef(new Map<string, HTMLDivElement>());

  const updateDrag = React.useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const handlePointerMove = React.useCallback(
    (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      const deltaX = e.clientX - current.startClientX;
      const deltaY = e.clientY - current.startClientY;
      if (!current.dragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
        return;
      }

      const deltaMin = deltaY / PX_PER_MIN;
      const durationMin = (current.originalEnd - current.originalStart) / 60000;
      const dayStart = startOfDay(date);

      let previewStart = current.previewStart;
      let previewEnd = current.previewEnd;
      let previewPractitionerId = current.previewPractitionerId;

      if (current.mode === "move") {
        const originalStartMin = minutesFromMidnight(current.originalStart);
        let newStartMin = snapMinutes(originalStartMin + deltaMin);
        newStartMin = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - durationMin, newStartMin));
        previewStart = dayStart + newStartMin * 60000;
        previewEnd = previewStart + durationMin * 60000;

        // Which practitioner column is the pointer over right now?
        for (const [practitionerId, el] of columnRefs.current) {
          const rect = el.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            previewPractitionerId = practitionerId;
            break;
          }
        }
      } else {
        const originalEndMin = minutesFromMidnight(current.originalEnd);
        const originalStartMin = minutesFromMidnight(current.originalStart);
        let newEndMin = snapMinutes(originalEndMin + deltaMin);
        newEndMin = Math.max(originalStartMin + MIN_DURATION_MIN, Math.min(DAY_END_MIN, newEndMin));
        previewEnd = dayStart + newEndMin * 60000;
      }

      updateDrag({ ...current, dragging: true, previewStart, previewEnd, previewPractitionerId });
    },
    [date, updateDrag],
  );

  const handlePointerUp = React.useCallback(
    (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      if (current.dragging) {
        onReschedule({
          appointmentId: current.appointmentId,
          start: current.previewStart,
          end: current.previewEnd,
          practitionerId:
            current.previewPractitionerId !== current.originalPractitionerId
              ? current.previewPractitionerId
              : undefined,
        });
      }
      updateDrag(null);
    },
    [onReschedule, updateDrag],
  );

  React.useEffect(() => {
    if (!drag) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [drag, handlePointerMove, handlePointerUp]);

  function startDrag(appointment: Appointment, mode: DragMode, e: React.PointerEvent) {
    e.stopPropagation();
    const next: DragState = {
      appointmentId: appointment._id,
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originalStart: appointment.start,
      originalEnd: appointment.end,
      originalPractitionerId: appointment.practitionerId,
      dragging: false,
      previewStart: appointment.start,
      previewEnd: appointment.end,
      previewPractitionerId: appointment.practitionerId,
    };
    updateDrag(next);
  }

  const hours = React.useMemo(() => {
    const list: number[] = [];
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) list.push(m);
    return list;
  }, []);

  const byPractitioner = React.useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const list = map.get(appt.practitionerId) ?? [];
      list.push(appt);
      map.set(appt.practitionerId, list);
    }
    return map;
  }, [appointments]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 pb-4">
        <Button variant="outline" size="sm" onClick={() => onDateChange(Date.now())}>
          {t("today")}
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => onDateChange(addDays(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDateChange(addDays(date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-[18px] font-semibold tracking-tight capitalize">
          {formatDayHeading(date, locale)}
        </span>
        <div className="grow" />
        <Segmented
          value={colourBy}
          onValueChange={setColourBy}
          options={[
            { value: "service", label: t("colourService") },
            { value: "status", label: t("colourStatus") },
          ]}
        />
      </div>

      <div className="flex-1 overflow-auto rounded-[14px] border border-border bg-card">
        <div className="flex">
          <div className="w-14 shrink-0 border-r border-border" />
          {practitioners.map((p) => (
            <div
              key={p._id}
              className="flex min-w-[220px] flex-1 items-center gap-2.5 border-r border-border px-3.5 py-3 last:border-r-0"
            >
              <Avatar size="sm" className={avatarTint(p._id)}>
                <AvatarFallback className={avatarTint(p._id)}>
                  {initials(p.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t("apptCount", { count: (byPractitioner.get(p._id) ?? []).length })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div ref={gridBodyRef} className="relative flex" style={{ height: GRID_HEIGHT }}>
          <div className="w-14 shrink-0 border-r border-border">
            {hours.map((m) => (
              <div
                key={m}
                className="relative text-right text-[11.5px] text-muted-foreground"
                style={{ height: 64 }}
              >
                <span className="absolute right-2 -top-[7px]">{formatHour(m, locale)}</span>
              </div>
            ))}
          </div>

          {practitioners.map((p) => {
            const appts = byPractitioner.get(p._id) ?? [];
            return (
              <div
                key={p._id}
                ref={(el) => {
                  if (el) columnRefs.current.set(p._id, el);
                  else columnRefs.current.delete(p._id);
                }}
                className="relative min-w-[220px] flex-1 border-r border-border last:border-r-0"
              >
                {hours.map((m) => (
                  <div
                    key={m}
                    className="absolute right-0 left-0 border-t border-border"
                    style={{ top: minutesToY(m) }}
                  />
                ))}
                {isToday && (
                  <NowLine />
                )}
                {appts.map((appt) => (
                  <AppointmentBlock
                    key={appt._id}
                    appointment={appt}
                    colourBy={colourBy}
                    selected={appt._id === selectedAppointmentId}
                    dimmed={drag?.dragging === true && drag.appointmentId === appt._id}
                    onClick={() => onSelectAppointment(appt._id)}
                    onStartMove={(e) => startDrag(appt, "move", e)}
                    onStartResize={(e) => startDrag(appt, "resize", e)}
                  />
                ))}
              </div>
            );
          })}

          {drag?.dragging && (
            <DragGhost
              drag={drag}
              appointment={appointments.find((a) => a._id === drag.appointmentId)}
              colourBy={colourBy}
              gridBodyRef={gridBodyRef}
              columnRefs={columnRefs}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DragGhost({
  drag,
  appointment,
  colourBy,
  gridBodyRef,
  columnRefs,
}: {
  drag: DragState;
  appointment: Appointment | undefined;
  colourBy: ColourBy;
  gridBodyRef: React.RefObject<HTMLDivElement | null>;
  columnRefs: React.RefObject<Map<string, HTMLDivElement>>;
}) {
  // DOM measurement can't happen during render (react-hooks/refs) -- the
  // column the ghost should sit in only changes when the pointer crosses a
  // column boundary, so re-measuring in an effect keyed on that id is both
  // correct and cheap (not re-measured on every pointermove's Y-only delta).
  const [columnBox, setColumnBox] = React.useState<{ left: number; width: number } | null>(null);
  React.useLayoutEffect(() => {
    const columnEl = columnRefs.current.get(drag.previewPractitionerId);
    const gridEl = gridBodyRef.current;
    if (!columnEl || !gridEl) {
      setColumnBox(null);
      return;
    }
    const columnRect = columnEl.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();
    setColumnBox({ left: columnRect.left - gridRect.left, width: columnRect.width });
  }, [drag.previewPractitionerId, columnRefs, gridBodyRef]);

  if (!appointment || !columnBox) return null;
  const colour = colourBy === "service" ? appointment.serviceColour : STATUS_COLOUR[appointment.status];
  const top = timeToY(drag.previewStart);
  const height = durationToHeight(drag.previewStart, drag.previewEnd);

  return (
    <div
      className="pointer-events-none absolute z-20 overflow-hidden rounded-lg border-2 px-2.5 py-1.5 shadow-card-lg"
      style={{
        left: columnBox.left,
        width: columnBox.width,
        top,
        height,
        backgroundColor: `color-mix(in srgb, ${colour} 22%, white)`,
        borderColor: "var(--color-brand-700)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: colour }}
      />
      <span className="truncate text-[12.5px] font-semibold text-foreground">
        {appointment.patientName}
      </span>
    </div>
  );
}

function NowLine() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const min = minutesFromMidnight(now);
  if (min < DAY_START_MIN || min > DAY_END_MIN) {
    return null;
  }
  return (
    <div className="absolute right-0 left-0 z-10 h-0.5 bg-[#E0485F]" style={{ top: timeToY(now) }}>
      <div className="absolute -top-1 -left-1 size-2.5 rounded-full bg-[#E0485F]" />
    </div>
  );
}

function AppointmentBlock({
  appointment,
  colourBy,
  selected,
  dimmed,
  onClick,
  onStartMove,
  onStartResize,
}: {
  appointment: Appointment;
  colourBy: ColourBy;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  onStartMove: (e: React.PointerEvent) => void;
  onStartResize: (e: React.PointerEvent) => void;
}) {
  const colour = colourBy === "service" ? appointment.serviceColour : STATUS_COLOUR[appointment.status];
  const top = timeToY(appointment.start);
  const height = durationToHeight(appointment.start, appointment.end);
  const done = appointment.status === "completed";
  const noShow = appointment.status === "no_show";
  const cancelled = appointment.status === "cancelled";
  // Rescheduling a visit that already happened (or didn't) isn't meaningful.
  const draggable = !done && !noShow && !cancelled;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={draggable ? onStartMove : undefined}
      className="absolute right-1.5 left-1.5 flex flex-col justify-center overflow-hidden rounded-lg border px-2.5 py-1.5 text-left"
      style={{
        top,
        height,
        backgroundColor: `color-mix(in srgb, ${colour} 13%, white)`,
        borderColor: selected ? "var(--color-brand-700)" : "transparent",
        boxShadow: selected ? "0 0 0 2px var(--color-brand-700)" : undefined,
        opacity: cancelled ? 0.5 : dimmed ? 0.35 : 1,
        cursor: draggable ? "grab" : undefined,
        touchAction: draggable ? "none" : undefined,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: colour }}
      />
      <span className="flex items-center gap-1 truncate text-[12.5px] font-semibold text-foreground">
        {appointment.patientName}
        {done && <Check className="size-3 shrink-0 text-status-done" />}
        {noShow && <UserRoundX className="size-3 shrink-0 text-status-noshow" />}
      </span>
      {height > 32 && (
        <span className="truncate text-[11.5px] text-muted-foreground">
          {appointment.serviceName}
        </span>
      )}
      {draggable && (
        <span
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize(e);
          }}
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
          style={{ touchAction: "none" }}
        />
      )}
    </button>
  );
}
