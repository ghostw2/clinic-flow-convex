"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Printer, Ban } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatALL } from "@/lib/format";
import { formatDateTime } from "@/lib/patient-format";

// Spec Sec7.5: "Because documents don't own money, all of this is safe...
// Void and reissue -- voided documents are retained and marked, never
// deleted." Generic output view for any document kind (receipt, invoice,
// proforma, quote, statement), replacing the need for a near-duplicate
// modal per kind -- ReceiptModal/ProposalModal predate this and still
// serve their own bespoke flows untouched.
export function GeneratedDocumentModal({
  documentId,
  onDone,
}: {
  documentId: Id<"documents">;
  onDone: () => void;
}) {
  const t = useTranslations("Documents");
  const locale = useLocale();
  const document = useQuery(api.billing.documents.getDocument, { documentId });
  const clinic = useQuery(api.clinic.getClinic);
  const patient = useQuery(
    api.patients.getPatient,
    document ? { patientId: document.patientId } : "skip",
  );
  const voidDocument = useMutation(api.billing.documents.voidDocument);
  const [voiding, setVoiding] = React.useState(false);

  if (!document || !patient) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="h-64 w-full max-w-[600px] animate-pulse rounded-2xl bg-card" />
      </div>
    );
  }

  const isVoided = document.voidedAt !== undefined;

  async function handleVoid() {
    const reason = window.prompt(t("voidReasonPrompt"));
    if (!reason) return;
    setVoiding(true);
    try {
      await voidDocument({ documentId, reason });
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-6">
      <div className="flex max-h-dvh w-full max-w-3xl flex-col overflow-y-auto rounded-none bg-card shadow-card-lg sm:flex-row sm:rounded-2xl">
        <div
          id="receipt-print-area"
          className="relative w-full border-b border-border bg-white p-5 text-[13px] sm:w-1/2 sm:border-r sm:border-b-0 sm:p-6"
        >
          {isVoided && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded border-4 border-status-cancel px-6 py-2 text-2xl font-bold text-status-cancel opacity-70">
                {t("voided")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-900">
              {clinic?.name?.slice(0, 2).toUpperCase() ?? "CF"}
            </div>
            <div>
              <div className="font-bold">{clinic?.name ?? "ClinicFlow"}</div>
              {clinic && (
                <div className="text-xs text-muted-foreground">
                  {clinic.address} · NIPT {clinic.nipt}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3">
            <div>
              <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(`kindLabel.${document.kind}`)}
              </div>
              <div className="font-bold">{document.number}</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {formatDateTime(document.issuedAt, locale)}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs text-muted-foreground">{t("patient")}</div>
            <div className="font-semibold">
              {document.payerName ?? `${patient.firstName} ${patient.lastName}`}
            </div>
            {document.payerNipt && (
              <div className="text-xs text-muted-foreground">NIPT {document.payerNipt}</div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1.5 border-t border-dashed border-border pt-3">
            {document.lines.map((line, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize">{line.description}</span>
                <span className="tabular-nums">{formatALL(line.amount)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-border pt-3">
            <div className="flex justify-between font-bold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{formatALL(document.total)}</span>
            </div>
          </div>

          <div className="mt-4 border-t border-dashed border-border pt-2 text-center text-[11px] text-muted-foreground">
            {t("nonFiscalFooter")}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 p-5 sm:w-1/2 sm:p-6">
          <div className="flex items-center gap-2 text-status-done">
            <CheckCircle2 className="size-5" />
            <span className="font-bold">{t("generated")}</span>
          </div>

          <Button className="mt-2 w-full" disabled={isVoided} onClick={() => window.print()}>
            <Printer className="size-4" /> {t("print")}
          </Button>

          {!isVoided && (
            <Button variant="outline" className="w-full" disabled={voiding} onClick={handleVoid}>
              <Ban className="size-4" /> {t("void")}
            </Button>
          )}

          <Button variant="outline" className="mt-auto w-full" onClick={onDone}>
            {t("done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
