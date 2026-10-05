"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  Clock3,
  CreditCard,
  Landmark,
  Mic,
  MoreHorizontal,
  Plus,
  Trash2,
  UserX2,
  Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoneyAmount } from "@/components/money-amount";
import { avatarTint, initials } from "@/lib/format";
import { ageFromDob, formatDate } from "@/lib/patient-format";
import { formatTimeRange } from "@/lib/calendar";
import { ReceiptModal } from "@/components/calendar/receipt-modal";

const NOTE_CHIPS = ["anaesthetic", "xray", "followUp", "prescription"] as const;

type Step = "detail" | "charge";

export function AppointmentPanel({
  appointmentId,
  onClose,
}: {
  appointmentId: Id<"appointments">;
  onClose: () => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const [step, setStep] = React.useState<Step>("detail");
  const [extraCharges, setExtraCharges] = React.useState<{ description: string; amount: number }[]>([]);
  const [includePrevious, setIncludePrevious] = React.useState(true);
  const [partialOpen, setPartialOpen] = React.useState(false);
  const [partialAmount, setPartialAmount] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [receiptDocId, setReceiptDocId] = React.useState<Id<"documents"> | null>(null);
  const [notes, setNotes] = React.useState<string | null>(null);

  const appointment = useQuery(api.appointments.getAppointment, { appointmentId });
  const patient = useQuery(
    api.patients.getPatient,
    appointment ? { patientId: appointment.patientId } : "skip",
  );
  const service = useQuery(
    api.services.getService,
    appointment ? { serviceId: appointment.serviceId } : "skip",
  );

  const checkIn = useMutation(api.appointments.checkIn);
  const updateStatus = useMutation(api.appointments.updateAppointmentStatus);
  const cancelAppointment = useMutation(api.appointments.cancelAppointment);
  const updateNotes = useMutation(api.appointments.updateAppointmentNotes);
  const completeAndCharge = useMutation(api.billing.completeVisit.completeAppointmentAndCharge);
  const generateReceipt = useMutation(api.billing.documents.generateReceipt);

  if (appointment === undefined || (appointment && (patient === undefined || service === undefined))) {
    return (
      <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
        <EntityDrawer.Header title="…" onClose={onClose} />
        <EntityDrawer.Body>
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </EntityDrawer.Body>
      </EntityDrawer>
    );
  }
  if (appointment === null || patient === null || service === null) {
    return (
      <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
        <EntityDrawer.Header title={t("notFound")} onClose={onClose} />
        <EntityDrawer.Body>
          <p className="text-sm text-muted-foreground">{t("notFoundHint")}</p>
        </EntityDrawer.Body>
      </EntityDrawer>
    );
  }
  // Unreachable given the two guards above; narrows patient/service from
  // `Doc | null | undefined` to `Doc` for TypeScript's control-flow analysis,
  // which can't track per-variable narrowing through compound OR checks.
  if (!appointment || !patient || !service) {
    return null;
  }

  const name = `${patient.firstName} ${patient.lastName}`;
  const age = ageFromDob(patient.dob);
  const isDone = appointment.status === "completed";
  const isCancelled = appointment.status === "cancelled";
  const currentNotes = notes ?? appointment.notes ?? "";

  const visitTotal = service.price + extraCharges.reduce((s, c) => s + c.amount, 0);
  const totalDue = includePrevious ? visitTotal + Math.max(0, patient.balance) : visitTotal;

  async function handleAdvanceStatus() {
    if (appointment!.status === "booked" || appointment!.status === "confirmed") {
      await checkIn({ appointmentId });
    } else if (appointment!.status === "arrived") {
      await updateStatus({ appointmentId, status: "in_progress" });
    }
  }

  async function handlePayment(amount: number, method: "cash" | "card" | "transfer" | "other") {
    setSubmitting(true);
    try {
      const { chargeIds, paymentId } = await completeAndCharge({
        appointmentId,
        extraCharges,
        payment: amount > 0 ? { amount, method } : undefined,
      });
      if (paymentId) {
        const documentId = await generateReceipt({
          patientId: appointment!.patientId,
          chargeIds,
          paymentIds: [paymentId],
          language: patient!.language,
        });
        setReceiptDocId(documentId);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (receiptDocId) {
    return (
      <ReceiptModal
        documentId={receiptDocId}
        onDone={() => {
          setReceiptDocId(null);
          onClose();
        }}
      />
    );
  }

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      {step === "detail" ? (
        <>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <Clock3 className="size-4 text-muted-foreground" />
            <span className="grow text-sm font-semibold">
              {formatTimeRange(appointment.start, appointment.end, locale)} · {appointment.practitionerName}
            </span>
            {!isDone && !isCancelled && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => cancelAppointment({ appointmentId })}>
                    {t("cancel")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              ×
            </button>
          </div>

          <EntityDrawer.Body className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg" className={avatarTint(patient._id)}>
                <AvatarFallback className={avatarTint(patient._id)}>{initials(name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-base font-bold">{name}</div>
                <div className="text-xs text-muted-foreground">
                  {age !== null && `${age} ${locale === "sq" ? "vjeç" : "y"} · `}
                  {patient.phone} ·{" "}
                  {t("patientSince", { year: new Date(patient._creationTime).getFullYear() })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {patient.balance > 0 && (
                <StatChip label={t("balanceOwed")} value={<MoneyAmount amount={patient.balance} tone="negative" />} tone="warn" />
              )}
              {patient.lastVisitAt && (
                <StatChip label={t("lastVisit")} value={formatDate(patient.lastVisitAt, locale)} />
              )}
              {patient.tags && patient.tags.length > 0 && (
                <StatChip label={t("alert")} value={patient.tags[0]} tone="danger" />
              )}
            </div>

            <StatusProgress status={appointment.status} />

            <div className="rounded-lg border border-border px-3 py-2.5">
              <div className="text-xs font-semibold text-muted-foreground">{t("service")}</div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-sm font-semibold">{service.name}</span>
                <MoneyAmount amount={service.price} />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{t("visitNote")}</span>
                <button type="button" disabled className="flex items-center gap-1 text-xs text-muted-foreground/50">
                  <Mic className="size-3.5" /> {t("dictate")}
                </button>
              </div>
              <textarea
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => updateNotes({ appointmentId, notes: currentNotes })}
                rows={4}
                className="w-full rounded-lg border border-input bg-card p-2.5 text-[13.5px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NOTE_CHIPS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNotes(`${currentNotes}${currentNotes ? " " : ""}${t(`noteChip.${key}`)}.`)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    + {t(`noteChip.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          </EntityDrawer.Body>

          <EntityDrawer.Footer className="flex-col items-stretch gap-2">
            {!isDone && !isCancelled && (appointment.status === "booked" || appointment.status === "confirmed" || appointment.status === "arrived") && (
              <Button variant="outline" className="w-full" onClick={handleAdvanceStatus}>
                {appointment.status === "arrived" ? t("startVisit") : t("checkInAction")}
              </Button>
            )}
            {!isDone && !isCancelled ? (
              <>
                <Button className="w-full justify-between" onClick={() => setStep("charge")}>
                  <span>{t("completeAndCharge")}</span>
                  <MoneyAmount amount={service.price} className="text-primary-foreground" />
                </Button>
                <div className="flex gap-2">
                  <RescheduleButton appointment={appointment} />
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => updateStatus({ appointmentId, status: "no_show" })}
                  >
                    <UserX2 className="size-4" /> {t("noShowAction")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                {isDone ? t("alreadyCompleted") : t("alreadyCancelled")}
              </div>
            )}
          </EntityDrawer.Footer>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <button onClick={() => setStep("detail")} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <ArrowLeft className="size-4" />
            </button>
            <div className="grow">
              <div className="text-sm font-bold">{t("completeAndCharge")}</div>
              <div className="text-xs text-muted-foreground">
                {name} · {service.name} · {formatTimeRange(appointment.start, appointment.end, locale).split(" – ")[0]}
              </div>
            </div>
            <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              ×
            </button>
          </div>

          <EntityDrawer.Body className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("charges")}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <span className="text-sm font-semibold">{service.name}</span>
                  <MoneyAmount amount={service.price} />
                </div>
                {extraCharges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <span className="text-sm">{c.description}</span>
                    <div className="flex items-center gap-2">
                      <MoneyAmount amount={c.amount} />
                      <button
                        type="button"
                        onClick={() => setExtraCharges((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <AddItemRow onAdd={(item) => setExtraCharges((prev) => [...prev, item])} />
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("thisVisit")}</span>
                <MoneyAmount amount={visitTotal} />
              </div>
              {patient.balance > 0 && (
                <label className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={includePrevious}
                      onChange={(e) => setIncludePrevious(e.target.checked)}
                    />
                    {t("includePreviousBalance")}
                  </span>
                  <MoneyAmount amount={patient.balance} />
                </label>
              )}
              <div className="flex justify-between text-base font-bold">
                <span>{t("totalDueNow")}</span>
                <MoneyAmount amount={totalDue} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("howDidTheyPay")}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handlePayment(totalDue, "cash")}
                className="flex w-full items-center gap-3 rounded-xl bg-brand-950 px-4 py-3.5 text-left text-white disabled:opacity-60"
              >
                <Wallet className="size-5" />
                <div>
                  <div className="text-sm font-bold">{t("paidInFullCash")}</div>
                  <div className="text-xs text-white/70">{t("paidInFullCashHint")}</div>
                </div>
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={submitting} onClick={() => handlePayment(totalDue, "card")}>
                  <CreditCard className="size-4" /> {t("cardPos")}
                </Button>
                <Button variant="outline" disabled={submitting} onClick={() => handlePayment(totalDue, "transfer")}>
                  <Landmark className="size-4" /> {t("bankTransfer")}
                </Button>
                <Button variant="outline" disabled={submitting} onClick={() => setPartialOpen((v) => !v)}>
                  {t("partialAmount")}
                </Button>
                <Button variant="outline" disabled title={t("comingSoon")}>
                  <CalendarClock className="size-4" /> {t("instalments")}
                </Button>
              </div>
              {partialOpen && (
                <div className="mt-2 flex gap-2">
                  <Input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="ALL"
                  />
                  <Button
                    disabled={submitting || !partialAmount}
                    onClick={() => handlePayment(Number(partialAmount), "cash")}
                  >
                    {t("confirm")}
                  </Button>
                </div>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handlePayment(0, "cash")}
                className="mt-3 w-full text-center text-xs text-muted-foreground underline"
              >
                {t("notPayingToday")}
              </button>
            </div>
          </EntityDrawer.Body>
        </>
      )}
    </EntityDrawer>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn" | "danger";
}) {
  return (
    <div
      className={
        tone === "warn"
          ? "rounded-lg bg-status-noshow-bg px-2.5 py-2"
          : tone === "danger"
            ? "rounded-lg bg-status-cancel-bg px-2.5 py-2"
            : "rounded-lg bg-muted px-2.5 py-2"
      }
    >
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {tone === "danger" && <CircleAlert className="size-3" />}
        {label}
      </div>
      <div className="text-[13px] font-bold">{value}</div>
    </div>
  );
}

const PROGRESS_STEPS = ["booked", "arrived", "in_progress", "completed"] as const;

function StatusProgress({ status }: { status: Doc<"appointments">["status"] }) {
  const t = useTranslations("Status.appointment");
  const normalized = status === "confirmed" ? "booked" : status;
  const idx = PROGRESS_STEPS.indexOf(normalized as (typeof PROGRESS_STEPS)[number]);
  return (
    <div className="flex gap-1.5">
      {PROGRESS_STEPS.map((s, i) => (
        <div key={s} className="flex-1">
          <div className={`h-1 rounded-full ${i <= idx ? "bg-status-done" : "bg-muted"}`} />
          <div className="mt-1 text-center text-[10.5px] text-muted-foreground">{t(s)}</div>
        </div>
      ))}
    </div>
  );
}

function AddItemRow({ onAdd }: { onAdd: (item: { description: string; amount: number }) => void }) {
  const t = useTranslations("Calendar");
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <Plus className="size-4" /> {t("addItem")}
      </button>
    );
  }
  return (
    <div className="mt-2 flex gap-2">
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("itemDescription")}
      />
      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="ALL"
        className="w-28"
      />
      <Button
        size="sm"
        disabled={!description || !amount}
        onClick={() => {
          onAdd({ description, amount: Number(amount) });
          setDescription("");
          setAmount("");
          setOpen(false);
        }}
      >
        {t("confirm")}
      </Button>
    </div>
  );
}

function RescheduleButton({ appointment }: { appointment: Doc<"appointments"> }) {
  const t = useTranslations("Calendar");
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(() => toLocalInputValue(appointment.start));
  const reschedule = useMutation(api.appointments.rescheduleAppointment);

  if (open) {
    return (
      <div className="flex flex-1 gap-1.5">
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="text-xs" />
        <Button
          size="sm"
          onClick={async () => {
            const newStart = new Date(value).getTime();
            const duration = appointment.end - appointment.start;
            await reschedule({ appointmentId: appointment._id, start: newStart, end: newStart + duration });
            setOpen(false);
          }}
        >
          {t("confirm")}
        </Button>
      </div>
    );
  }
  return (
    <Button variant="outline" className="flex-1" onClick={() => setOpen(true)}>
      <CalendarClock className="size-4" /> {t("reschedule")}
    </Button>
  );
}

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
