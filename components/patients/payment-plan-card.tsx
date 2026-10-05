"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { MoneyAmount } from "@/components/money-amount";
import { Segmented } from "@/components/chip";
import { formatDate } from "@/lib/patient-format";
import { cn } from "cn";

type Installment = Doc<"installments">;

const INSTALLMENT_STATUS_TONE: Record<Installment["status"], string> = {
  pending: "bg-status-neutral-bg text-status-neutral",
  paid: "bg-status-done-bg text-status-done",
  overdue: "bg-status-cancel-bg text-status-cancel",
  cancelled: "bg-muted text-muted-foreground",
};

// Spec Sec7.6: "Create a plan from any balance -- not just from a course."
// Lives on the Billing tab (not the course view) so it's reachable for any
// patient with an outstanding balance, matching that framing exactly.
export function PaymentPlanCard({ patient }: { patient: Doc<"patients"> }) {
  const t = useTranslations("PaymentPlan");
  const plans = useQuery(api.billing.paymentPlans.listPlansForPatient, { patientId: patient._id });
  const [generatorOpen, setGeneratorOpen] = React.useState(false);

  const activePlan = plans?.find((p) => p.status === "active");

  if (plans === undefined) {
    return <div className="h-32 animate-pulse rounded-[14px] bg-muted" />;
  }

  if (!activePlan) {
    if (patient.balance <= 0) return null;
    return (
      <div className="rounded-[14px] border border-border bg-card p-[18px]">
        <h3 className="mb-2.5 text-[14.5px] font-semibold">{t("title")}</h3>
        <p className="mb-3 text-sm text-muted-foreground">{t("noPlanHint")}</p>
        <Button variant="outline" className="w-full" onClick={() => setGeneratorOpen(true)}>
          <CalendarClock className="size-4" /> {t("createPlan")}
        </Button>
        {generatorOpen && (
          <PlanGeneratorDrawer patientId={patient._id} onClose={() => setGeneratorOpen(false)} />
        )}
      </div>
    );
  }

  return <ActivePlanCard plan={activePlan} />;
}

function ActivePlanCard({ plan }: { plan: Doc<"paymentPlans"> }) {
  const t = useTranslations("PaymentPlan");
  const locale = useLocale();
  const data = useQuery(api.billing.paymentPlans.getPlanWithInstallments, { planId: plan._id });
  const settlePlan = useMutation(api.billing.paymentPlans.settlePlan);
  const recalculatePlan = useMutation(api.billing.paymentPlans.recalculatePlan);
  const cancelPlan = useMutation(api.billing.paymentPlans.cancelPlan);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<Id<"installments"> | null>(null);

  const installments = data?.installments ?? [];
  const paidCount = installments.filter((i) => i.status === "paid").length;

  async function run(fn: () => Promise<unknown>) {
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-[18px]">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[14.5px] font-semibold">{t("title")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("progress", { done: paidCount, total: installments.length })}
        </span>
      </div>
      <div className="mb-3 text-xs text-muted-foreground">
        {t("basis")}: <MoneyAmount amount={plan.basisAmount} className="text-xs" />
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        {installments.map((inst) =>
          editingId === inst._id ? (
            <InstallmentEditRow key={inst._id} installment={inst} onDone={() => setEditingId(null)} />
          ) : (
            <button
              key={inst._id}
              type="button"
              onClick={() => inst.status !== "paid" && inst.status !== "cancelled" && setEditingId(inst._id)}
              className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-left text-xs"
            >
              <span className="text-muted-foreground">{formatDate(inst.dueDate, locale)}</span>
              <span className="flex items-center gap-1.5">
                <MoneyAmount amount={inst.amount} className="text-xs" />
                <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", INSTALLMENT_STATUS_TONE[inst.status])}>
                  {t(`status.${inst.status}`)}
                </span>
              </span>
            </button>
          ),
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Button size="sm" disabled={submitting} onClick={() => run(() => settlePlan({ planId: plan._id, method: "cash" }))}>
          {t("settleBalance")}
        </Button>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => run(() => recalculatePlan({ planId: plan._id }))}
          >
            {t("recalculate")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => run(() => cancelPlan({ planId: plan._id }))}
          >
            {t("cancelPlan")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InstallmentEditRow({ installment, onDone }: { installment: Installment; onDone: () => void }) {
  const t = useTranslations("PaymentPlan");
  const updateInstallment = useMutation(api.billing.paymentPlans.updateInstallment);
  const [amount, setAmount] = React.useState(String(installment.amount));
  const [date, setDate] = React.useState(() => {
    const d = new Date(installment.dueDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  async function handleSave() {
    await updateInstallment({
      installmentId: installment._id,
      amount: Number(amount) || installment.amount,
      dueDate: new Date(date).getTime(),
    });
    onDone();
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-brand-700 px-2.5 py-1.5">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" />
      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-7 w-28 text-xs" />
      <Button size="sm" onClick={handleSave}>
        {t("save")}
      </Button>
      <button type="button" onClick={onDone} className="text-xs text-muted-foreground">
        {t("cancel")}
      </button>
    </div>
  );
}

function PlanGeneratorDrawer({
  patientId,
  onClose,
}: {
  patientId: Id<"patients">;
  onClose: () => void;
}) {
  const t = useTranslations("PaymentPlan");
  const [installmentCount, setInstallmentCount] = React.useState("3");
  const [frequency, setFrequency] = React.useState<"monthly" | "biweekly">("monthly");
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [submitting, setSubmitting] = React.useState(false);
  const createPlan = useMutation(api.billing.paymentPlans.createPaymentPlan);

  async function handleCreate() {
    setSubmitting(true);
    try {
      await createPlan({
        patientId,
        installmentCount: Math.max(1, Number(installmentCount) || 1),
        frequency,
        startDate: new Date(startDate).getTime(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={t("createPlan")} onClose={onClose} />
      <EntityDrawer.Body className="flex flex-col gap-4">
        <FormField label={t("installmentCount")} htmlFor="installmentCount">
          <Input
            id="installmentCount"
            type="number"
            min={1}
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
          />
        </FormField>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("frequency")}</div>
          <Segmented
            value={frequency}
            onValueChange={setFrequency}
            options={[
              { value: "monthly", label: t("monthly") },
              { value: "biweekly", label: t("biweekly") },
            ]}
          />
        </div>
        <FormField label={t("startDate")} htmlFor="startDate">
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        <Button className="w-full" disabled={submitting} onClick={handleCreate}>
          {t("createPlan")}
        </Button>
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}
