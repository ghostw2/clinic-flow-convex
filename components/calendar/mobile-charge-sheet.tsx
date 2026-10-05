"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, CreditCard, Landmark, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoneyAmount } from "@/components/money-amount";
import { ReceiptModal } from "@/components/calendar/receipt-modal";
import { avatarTint, initials } from "@/lib/format";
import { formatTime } from "@/lib/calendar";

// Frame 14: on phone widths, tapping an agenda row opens this bottom sheet
// directly rather than a full detail screen -- EntityDrawer already renders
// as a sheet below 768px, so this is the same composite mutation path as the
// desktop/tablet "complete & charge" step, just the mobile-only entry point.
export function MobileChargeSheet({
  appointmentId,
  onClose,
}: {
  appointmentId: Id<"appointments">;
  onClose: () => void;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const [partialOpen, setPartialOpen] = React.useState(false);
  const [partialAmount, setPartialAmount] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [receiptDocId, setReceiptDocId] = React.useState<Id<"documents"> | null>(null);

  const appointment = useQuery(api.appointments.getAppointment, { appointmentId });
  const patient = useQuery(api.patients.getPatient, appointment ? { patientId: appointment.patientId } : "skip");
  const service = useQuery(api.services.getService, appointment ? { serviceId: appointment.serviceId } : "skip");

  const completeAndCharge = useMutation(api.billing.completeVisit.completeAppointmentAndCharge);
  const generateReceipt = useMutation(api.billing.documents.generateReceipt);

  if (receiptDocId) {
    return <ReceiptModal documentId={receiptDocId} onDone={() => { setReceiptDocId(null); onClose(); }} />;
  }

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
  // Unreachable given the two guards above; narrows patient/service for
  // TypeScript's control-flow analysis (see appointment-panel.tsx's twin).
  if (!appointment || !patient || !service) {
    return null;
  }

  const previousBalance = Math.max(0, patient.balance);
  const totalDue = service.price + previousBalance;

  async function handlePayment(amount: number, method: "cash" | "card" | "transfer" | "other") {
    setSubmitting(true);
    try {
      const { chargeIds, paymentId } = await completeAndCharge({
        appointmentId,
        extraCharges: [],
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

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Avatar size="sm" className={avatarTint(patient._id)}>
          <AvatarFallback className={avatarTint(patient._id)}>{initials(appointment.patientName)}</AvatarFallback>
        </Avatar>
        <div className="grow">
          <div className="text-sm font-bold">{appointment.patientName}</div>
          <div className="text-xs text-muted-foreground">
            {service.name} · {formatTime(appointment.start, locale)}
          </div>
        </div>
        <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          ×
        </button>
      </div>

      <EntityDrawer.Body className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("thisVisit")}</span>
            <MoneyAmount amount={service.price} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("mobile.previousBalance")}</span>
            <MoneyAmount amount={previousBalance} />
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>{t("mobile.amountDue")}</span>
            <MoneyAmount amount={totalDue} />
          </div>
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

        <div className="grid grid-cols-2 gap-2">
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
          <div className="flex gap-2">
            <Input
              type="number"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder="ALL"
            />
            <Button disabled={submitting || !partialAmount} onClick={() => handlePayment(Number(partialAmount), "cash")}>
              {t("confirm")}
            </Button>
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => handlePayment(0, "cash")}
          className="text-center text-xs text-muted-foreground underline"
        >
          {t("notPayingToday")}
        </button>
      </EntityDrawer.Body>
    </EntityDrawer>
  );
}
