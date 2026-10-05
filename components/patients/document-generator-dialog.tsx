"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations, useLocale } from "next-intl";
import { Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/chip";
import { FormField } from "@/components/form-field";
import { MoneyAmount } from "@/components/money-amount";
import { GeneratedDocumentModal } from "@/components/patients/generated-document-modal";
import { openCharges } from "@/lib/patient-billing";
import { formatDate } from "@/lib/patient-format";

type DocKind = "receipt" | "invoice" | "proforma" | "quote" | "statement";

// Spec Sec7.5: "One generation dialog, reachable from the patient page, the
// appointment panel, and the Finances screen: 1. kind 2. what goes on it
// 3. payer 4. language 5. Generate." Only the patient-page entry point is
// wired up this pass (Billing tab) -- the other two reuse the same
// component, just a later wiring step, not a different dialog to build.
export function DocumentGeneratorDialog({
  patientId,
  onClose,
}: {
  patientId: Id<"patients">;
  onClose: () => void;
}) {
  const t = useTranslations("Documents");
  const locale = useLocale();
  const patient = useQuery(api.patients.getPatient, { patientId });
  const charges = useQuery(api.billing.charges.listChargesForPatient, { patientId });
  const payments = useQuery(api.billing.payments.listPaymentsForPatient, { patientId });

  const [kind, setKind] = React.useState<DocKind>("receipt");
  const [selectedCharges, setSelectedCharges] = React.useState<Set<Id<"charges">>>(new Set());
  const [selectedPayments, setSelectedPayments] = React.useState<Set<Id<"payments">>>(new Set());
  const [payerMode, setPayerMode] = React.useState<"patient" | "thirdParty">("patient");
  const [payerName, setPayerName] = React.useState("");
  const [payerNipt, setPayerNipt] = React.useState("");
  const [payerAddress, setPayerAddress] = React.useState("");
  const [language, setLanguage] = React.useState<"sq" | "en" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [resultDocId, setResultDocId] = React.useState<Id<"documents"> | null>(null);

  const generateDocument = useMutation(api.billing.documents.generateDocument);

  const effectiveLanguage = language ?? patient?.language ?? (locale === "sq" ? "sq" : "en");

  function toggleCharge(id: Id<"charges">) {
    setSelectedCharges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedPayments(new Set());
  }

  function togglePayment(id: Id<"payments">) {
    setSelectedPayments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedCharges(new Set());
  }

  function selectAllOpenCharges() {
    if (!charges || !payments) return;
    const open = openCharges(charges, payments);
    setSelectedCharges(new Set(open.map((o) => o.charge._id)));
    setSelectedPayments(new Set());
  }

  function selectAllPaymentsThisYear() {
    if (!payments) return;
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const ids = payments.filter((p) => p.receivedAt >= yearStart).map((p) => p._id);
    setSelectedPayments(new Set(ids));
    setSelectedCharges(new Set());
  }

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const documentId = await generateDocument({
        patientId,
        kind,
        chargeIds: [...selectedCharges],
        paymentIds: [...selectedPayments],
        payerName: payerMode === "thirdParty" ? payerName : undefined,
        payerNipt: payerMode === "thirdParty" ? payerNipt : undefined,
        payerAddress: payerMode === "thirdParty" ? payerAddress : undefined,
        language: effectiveLanguage,
      });
      setResultDocId(documentId);
    } finally {
      setSubmitting(false);
    }
  }

  if (resultDocId) {
    return <GeneratedDocumentModal documentId={resultDocId} onDone={onClose} />;
  }

  const hasSelection = selectedCharges.size > 0 || selectedPayments.size > 0;
  const canSubmit =
    hasSelection && (payerMode === "patient" || payerName.trim().length > 0) && !submitting;

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={t("title")} onClose={onClose} />
      <EntityDrawer.Body className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("kind")}</div>
          <Segmented
            value={kind}
            onValueChange={(v) => setKind(v as DocKind)}
            options={[
              { value: "receipt", label: t("kindReceipt") },
              { value: "invoice", label: t("kindInvoice") },
              { value: "proforma", label: t("kindProforma") },
              { value: "quote", label: t("kindQuote") },
              { value: "statement", label: t("kindStatement") },
            ]}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t("charges")}</span>
            <button type="button" onClick={selectAllOpenCharges} className="text-xs font-semibold text-primary">
              {t("selectAllOpen")}
            </button>
          </div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {(charges ?? []).length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("noCharges")}</p>
            )}
            {(charges ?? []).map((c) => (
              <label key={c._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={selectedCharges.has(c._id)} onCheckedChange={() => toggleCharge(c._id)} />
                <span className="grow truncate">
                  {formatDate(c.occurredAt, locale)} · {c.description}
                </span>
                <MoneyAmount amount={c.amount} className="text-xs" />
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t("payments")}</span>
            <button type="button" onClick={selectAllPaymentsThisYear} className="text-xs font-semibold text-primary">
              {t("selectAllThisYear")}
            </button>
          </div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {(payments ?? []).length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("noPayments")}</p>
            )}
            {(payments ?? []).map((p) => (
              <label key={p._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={selectedPayments.has(p._id)} onCheckedChange={() => togglePayment(p._id)} />
                <span className="grow truncate capitalize">
                  {formatDate(p.receivedAt, locale)} · {p.method}
                </span>
                <MoneyAmount amount={p.amount} className="text-xs" />
              </label>
            ))}
          </div>
          {selectedCharges.size > 0 && selectedPayments.size > 0 && (
            <p className="mt-1 text-xs text-status-noshow">{t("mixedSelectionHint")}</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("payer")}</div>
          <Segmented
            value={payerMode}
            onValueChange={(v) => setPayerMode(v as "patient" | "thirdParty")}
            options={[
              { value: "patient", label: t("payerPatient") },
              { value: "thirdParty", label: t("payerThirdParty") },
            ]}
          />
          {payerMode === "thirdParty" && (
            <div className="mt-2 flex flex-col gap-2">
              <FormField label={t("payerName")} htmlFor="payerName">
                <Input id="payerName" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
              </FormField>
              <FormField label={t("payerNipt")} htmlFor="payerNipt">
                <Input id="payerNipt" value={payerNipt} onChange={(e) => setPayerNipt(e.target.value)} />
              </FormField>
              <FormField label={t("payerAddress")} htmlFor="payerAddress">
                <Input id="payerAddress" value={payerAddress} onChange={(e) => setPayerAddress(e.target.value)} />
              </FormField>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("language")}</div>
          <Segmented
            value={effectiveLanguage}
            onValueChange={(v) => setLanguage(v as "sq" | "en")}
            options={[
              { value: "sq", label: "Shqip" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        <Button className="w-full" disabled={!canSubmit} onClick={handleGenerate}>
          <Send className="size-4" /> {t("generate")}
        </Button>
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}
