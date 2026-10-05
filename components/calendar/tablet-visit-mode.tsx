"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, CalendarDays, LayoutDashboard, Mic, Search, Stethoscope, UserRoundPlus, Users, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ServiceDot } from "@/components/service-dot";
import { MoneyAmount } from "@/components/money-amount";
import { ReceiptModal } from "@/components/calendar/receipt-modal";
import { useCommandPalette } from "@/components/command-palette";
import { avatarTint, initials } from "@/lib/format";
import { ageFromDob } from "@/lib/patient-format";
import { formatDayHeading, formatTime } from "@/lib/calendar";
import { FDI_LOWER, FDI_UPPER } from "@/lib/tooth-chart";
import { cn } from "cn";

type Appt = {
  _id: Id<"appointments">;
  patientId: Id<"patients">;
  practitionerId: Id<"users">;
  serviceId: Id<"services">;
  start: number;
  end: number;
  status: string;
  patientName: string;
  serviceName: string;
  serviceColour: string;
};

const RAIL_ITEMS = [
  { href: "/", icon: LayoutDashboard },
  { href: "/calendar", icon: CalendarDays },
  { href: "/patients", icon: Users },
  { href: "/finances", icon: Wallet },
] as const;

// Frame 12: at tablet widths the calendar route drops AppShell's sidebar for
// an icon rail + single-column "Today" list + full-height detail pane, so an
// operator standing at the chair never has to open a drawer over the content.
export function TabletVisitMode({
  date,
  appointments,
  selectedAppointmentId,
  onSelectAppointment,
  onWalkIn,
  onNewAppointment,
}: {
  date: number;
  appointments: Appt[];
  selectedAppointmentId: Id<"appointments"> | null;
  onSelectAppointment: (id: Id<"appointments"> | null) => void;
  onWalkIn: () => void;
  onNewAppointment: () => void;
}) {
  return (
    <div className="flex h-dvh bg-background">
      <TabletRail />
      <TabletList
        date={date}
        appointments={appointments}
        selectedId={selectedAppointmentId}
        onSelect={onSelectAppointment}
        onWalkIn={onWalkIn}
      />
      {selectedAppointmentId ? (
        <TabletDetail appointmentId={selectedAppointmentId} onClose={() => onSelectAppointment(null)} />
      ) : (
        <TabletEmptyDetail onNewAppointment={onNewAppointment} />
      )}
    </div>
  );
}

function TabletRail() {
  const pathname = usePathname();
  const palette = useCommandPalette();
  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-1 bg-sidebar py-4 text-sidebar-foreground">
      <div className="mb-3 flex size-8 items-center justify-center rounded-[9px] bg-brand-300 text-brand-950">
        <Activity className="size-[18px]" strokeWidth={2.4} />
      </div>
      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex size-10 items-center justify-center rounded-lg text-sidebar-foreground/60",
              active && "bg-sidebar-accent text-brand-300",
            )}
          >
            <Icon className="size-[18px]" />
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => palette.open()}
        className="flex size-10 items-center justify-center rounded-lg text-sidebar-foreground/60"
      >
        <Search className="size-[18px]" />
      </button>
      <div className="flex-1" />
      <Link href="/settings" className="mb-1">
        <Avatar size="sm">
          <AvatarFallback>EH</AvatarFallback>
        </Avatar>
      </Link>
    </aside>
  );
}

function TabletList({
  date,
  appointments,
  selectedId,
  onSelect,
  onWalkIn,
}: {
  date: number;
  appointments: Appt[];
  selectedId: Id<"appointments"> | null;
  onSelect: (id: Id<"appointments">) => void;
  onWalkIn: () => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const sorted = [...appointments].sort((a, b) => a.start - b.start);
  const leftCount = sorted.filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show").length;

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card">
      <div className="px-5 pt-5 pb-4">
        <div className="text-xl font-bold">{t("today")}</div>
        <div className="text-xs text-muted-foreground capitalize">
          {formatDayHeading(date, locale)} · {t("tablet.leftCount", { count: leftCount })}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-1.5 pb-2">
        {sorted.map((appt) => {
          const active = appt._id === selectedId;
          return (
            <button
              key={appt._id}
              type="button"
              onClick={() => onSelect(appt._id)}
              className={cn(
                "mb-1 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left",
                active ? "border-status-done bg-status-done-bg/50" : "border-transparent hover:bg-muted/50",
              )}
            >
              <Avatar size="sm" className={avatarTint(appt.patientId)}>
                <AvatarFallback className={avatarTint(appt.patientId)}>{initials(appt.patientName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 grow">
                <div className="truncate text-sm font-semibold">{appt.patientName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatTime(appt.start, locale)} · {appt.serviceName}
                </div>
              </div>
              <ServiceDot colour={appt.serviceColour} />
            </button>
          );
        })}
      </div>
      <div className="border-t border-border p-3">
        <Button variant="outline" className="w-full" onClick={onWalkIn}>
          <Stethoscope className="size-4" /> {t("walkIn")}
        </Button>
      </div>
    </div>
  );
}

function TabletEmptyDetail({ onNewAppointment }: { onNewAppointment: () => void }) {
  const t = useTranslations("Calendar");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <p>{t("notFoundHint")}</p>
      <Button onClick={onNewAppointment}>
        <UserRoundPlus className="size-4" /> {t("newAppointment")}
      </Button>
    </div>
  );
}

const NOTE_CHIPS = ["anaesthetic", "xray", "followUp", "prescription"] as const;

function TabletDetail({ appointmentId, onClose }: { appointmentId: Id<"appointments">; onClose: () => void }) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const [notes, setNotes] = React.useState<string | null>(null);
  const [selectedTooth, setSelectedTooth] = React.useState<number | null>(null);
  const [extraCharges] = React.useState<{ description: string; amount: number }[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [receiptDocId, setReceiptDocId] = React.useState<Id<"documents"> | null>(null);
  const [now] = React.useState(() => Date.now());

  const appointment = useQuery(api.appointments.getAppointment, { appointmentId });
  const patient = useQuery(api.patients.getPatient, appointment ? { patientId: appointment.patientId } : "skip");
  const service = useQuery(api.services.getService, appointment ? { serviceId: appointment.serviceId } : "skip");

  const updateNotes = useMutation(api.appointments.updateAppointmentNotes);
  const completeAndCharge = useMutation(api.billing.completeVisit.completeAppointmentAndCharge);
  const generateReceipt = useMutation(api.billing.documents.generateReceipt);

  if (receiptDocId) {
    return <ReceiptModal documentId={receiptDocId} onDone={() => { setReceiptDocId(null); onClose(); }} />;
  }

  if (appointment === undefined || (appointment && (patient === undefined || service === undefined))) {
    return <div className="flex-1 animate-pulse bg-muted/30" />;
  }
  if (appointment === null || patient === null || service === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">{t("notFound")}</div>
    );
  }
  // Unreachable given the two guards above; narrows patient/service from
  // `Doc | null | undefined` to `Doc` for TypeScript's control-flow analysis,
  // which can't track per-variable narrowing through compound OR checks.
  if (!appointment || !patient || !service) {
    return null;
  }

  const name = appointment.patientName;
  const age = ageFromDob(patient.dob);
  const currentNotes = notes ?? appointment.notes ?? "";
  const isDone = appointment.status === "completed";
  const visitTotal = service.price + extraCharges.reduce((s, c) => s + c.amount, 0);
  const totalDue = visitTotal + Math.max(0, patient.balance);
  const inProgressMin = Math.max(0, Math.round((now - appointment.start) / 60000));

  function appendChip(key: (typeof NOTE_CHIPS)[number]) {
    const next = `${currentNotes}${currentNotes ? " " : ""}${t(`noteChip.${key}`)}.`;
    setNotes(next);
    void updateNotes({ appointmentId, notes: next });
  }

  async function handleCompletePaidInFullCash() {
    setSubmitting(true);
    try {
      const { chargeIds, paymentId } = await completeAndCharge({
        appointmentId,
        extraCharges,
        payment: { amount: totalDue, method: "cash" },
      });
      if (paymentId) {
        const documentId = await generateReceipt({
          patientId: appointment!.patientId,
          chargeIds,
          paymentIds: [paymentId],
          language: patient!.language,
        });
        setReceiptDocId(documentId);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="flex items-start gap-4 px-7 py-5">
        <Avatar size="lg" className={avatarTint(patient._id)}>
          <AvatarFallback className={avatarTint(patient._id)}>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="grow">
          <div className="text-2xl font-bold">{name}</div>
          <div className="text-sm text-muted-foreground">
            {age !== null && `${age} ${locale === "sq" ? "vjeç" : "y"} · `}
            {service.name}
            {appointment.status === "in_progress" && ` · ${t("tablet.startedAt", { time: formatTime(appointment.start, locale) })}`}
          </div>
        </div>
        {patient.balance > 0 && (
          <div className="text-right">
            <div className="text-xs font-semibold text-status-noshow">{t("tablet.owesLabel")}</div>
            <MoneyAmount amount={patient.balance} tone="negative" className="text-xl font-bold" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-7 py-3">
        {(patient.tags ?? []).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-status-cancel-bg px-2.5 py-1 text-xs font-semibold text-status-cancel"
          >
            {tag}
          </span>
        ))}
        {appointment.status === "in_progress" && (
          <span className="rounded-full bg-status-progress-bg px-2.5 py-1 text-xs font-semibold text-status-progress">
            {t("tablet.inProgressMin", { min: inProgressMin })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 px-7 pb-32 pt-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{t("visitNote")}</span>
            <button type="button" disabled className="flex items-center gap-1 text-xs text-muted-foreground/50">
              <Mic className="size-3.5" /> {t("dictate")}
            </button>
          </div>
          <textarea
            value={currentNotes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void updateNotes({ appointmentId, notes: currentNotes })}
            rows={3}
            className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {NOTE_CHIPS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => appendChip(key)}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                + {t(`noteChip.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div>
            <div className="text-sm font-semibold">{t("tablet.chargeLabel")}</div>
            <div className="text-xs text-muted-foreground">
              {service.name} {service.price.toLocaleString()}
              {extraCharges.map((c) => ` + ${c.description} ${c.amount.toLocaleString()}`).join("")}
              {patient.balance > 0 ? ` + ${locale === "sq" ? "mëparshme" : "previous"} ${patient.balance.toLocaleString()}` : ""}
            </div>
          </div>
          <MoneyAmount amount={totalDue} className="text-xl font-bold" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{t("tablet.toothLabel")}</span>
            <span className="text-xs text-muted-foreground">{t("tablet.toothHint")}</span>
          </div>
          <ToothGrid row={FDI_UPPER} selected={selectedTooth} onSelect={setSelectedTooth} />
          <ToothGrid row={FDI_LOWER} selected={selectedTooth} onSelect={setSelectedTooth} />
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-status-done" /> {t("tablet.toothLegendToday")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-status-progress" /> {t("tablet.toothLegendPrevious")}
            </span>
          </div>
        </div>
      </div>

      {!isDone && appointment.status !== "cancelled" && (
        <div className="fixed inset-x-16 bottom-0 flex gap-2 border-t border-border bg-card p-3">
          <Button variant="outline" className="h-14">
            <CalendarDays className="size-4" /> {t("tablet.bookNext")}
          </Button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleCompletePaidInFullCash}
            className="flex h-14 flex-1 items-center justify-between rounded-xl bg-brand-950 px-5 text-white disabled:opacity-60"
          >
            <div className="text-left">
              <div className="text-sm font-bold">{t("tablet.completeOneTap")}</div>
              <div className="text-xs text-white/70">{t("paidInFullCashHint")}</div>
            </div>
            <MoneyAmount amount={totalDue} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToothGrid({
  row,
  selected,
  onSelect,
}: {
  row: readonly number[];
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="mb-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
      {row.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          className={cn(
            "rounded-md py-1.5 text-center text-xs font-semibold",
            n === selected ? "bg-status-done text-white" : "bg-muted text-foreground hover:bg-muted/70",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
