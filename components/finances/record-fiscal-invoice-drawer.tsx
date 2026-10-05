"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Upload } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/chip";
import { FormField } from "@/components/form-field";
import { formatALL } from "@/lib/format";

type InvoiceType = "cash" | "noncash" | "self" | "corrective";

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

// Spec Sec7.9.1 step 1: "Manual entry -- two fields and a file picker.
// Fifteen seconds. Always works. Ship this first." The two load-bearing
// fields are NIVF and NSLF; fiscalNumber/date/type/total round out the
// fiscalRecord shape the schema already carries. Steps 2 (QR paste) and 3
// (PDF regex) are deliberately absent -- not stubbed -- until the portal's
// QR parameter names are verified against a real invoice (spec: "not worth
// guessing at").
export function RecordFiscalInvoiceDrawer({
  documentId,
  onClose,
}: {
  documentId: Id<"documents">;
  onClose: () => void;
}) {
  const t = useTranslations("Finances");
  const doc = useQuery(api.billing.documents.getDocument, { documentId });

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={t("fiscalRecordTitle")} onClose={onClose} />
      {doc ? (
        <RecordFiscalInvoiceForm doc={doc} onClose={onClose} />
      ) : (
        <EntityDrawer.Body>
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </EntityDrawer.Body>
      )}
    </EntityDrawer>
  );
}

function RecordFiscalInvoiceForm({
  doc,
  onClose,
}: {
  doc: Doc<"documents">;
  onClose: () => void;
}) {
  const t = useTranslations("Finances");
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const recordFiscalInvoice = useMutation(api.billing.documents.recordFiscalInvoice);

  const [nivf, setNivf] = React.useState("");
  const [nslf, setNslf] = React.useState("");
  const [fiscalNumber, setFiscalNumber] = React.useState("");
  const [fiscalDate, setFiscalDate] = React.useState(todayDateInput());
  const [invoiceType, setInvoiceType] = React.useState<InvoiceType>("cash");
  const [totalOnFiscal, setTotalOnFiscal] = React.useState(() => String(doc.total));
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const parsedTotal = Number(totalOnFiscal);
  const mismatch = totalOnFiscal.trim() !== "" && !Number.isNaN(parsedTotal) && parsedTotal !== doc.total;

  const canSubmit =
    nivf.trim().length > 0 &&
    nslf.trim().length > 0 &&
    fiscalNumber.trim().length > 0 &&
    file !== null &&
    !Number.isNaN(parsedTotal) &&
    !submitting;

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
      await recordFiscalInvoice({
        documentId: doc._id,
        pdfStorageId: storageId,
        nivf: nivf.trim(),
        nslf: nslf.trim(),
        fiscalNumber: fiscalNumber.trim(),
        fiscalDate: new Date(fiscalDate).getTime(),
        invoiceType,
        totalOnFiscal: parsedTotal,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <EntityDrawer.Body className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="font-semibold">{doc.number}</div>
          <div className="text-muted-foreground">{formatALL(doc.total)}</div>
        </div>

        <FormField label={t("fiscalNivf")} htmlFor="nivf">
          <Input id="nivf" value={nivf} onChange={(e) => setNivf(e.target.value)} />
        </FormField>
        <FormField label={t("fiscalNslf")} htmlFor="nslf">
          <Input id="nslf" value={nslf} onChange={(e) => setNslf(e.target.value)} />
        </FormField>
        <FormField label={t("fiscalNumber")} htmlFor="fiscalNumber">
          <Input
            id="fiscalNumber"
            value={fiscalNumber}
            onChange={(e) => setFiscalNumber(e.target.value)}
            placeholder="12/2026/TCRxxxxxxxx"
          />
        </FormField>
        <FormField label={t("fiscalDate")} htmlFor="fiscalDate">
          <Input
            id="fiscalDate"
            type="date"
            value={fiscalDate}
            onChange={(e) => setFiscalDate(e.target.value)}
          />
        </FormField>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("fiscalInvoiceType")}</div>
          <Segmented
            value={invoiceType}
            onValueChange={(v) => setInvoiceType(v as InvoiceType)}
            options={[
              { value: "cash", label: t("fiscalTypeCash") },
              { value: "noncash", label: t("fiscalTypeNoncash") },
              { value: "self", label: t("fiscalTypeSelf") },
              { value: "corrective", label: t("fiscalTypeCorrective") },
            ]}
          />
        </div>

        <FormField label={t("fiscalTotal")} htmlFor="totalOnFiscal">
          <Input
            id="totalOnFiscal"
            type="number"
            value={totalOnFiscal}
            onChange={(e) => setTotalOnFiscal(e.target.value)}
          />
        </FormField>

        {mismatch && (
          <div className="flex items-start gap-2 rounded-lg bg-status-noshow-bg p-3 text-xs text-status-noshow">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{t("fiscalMismatchWarning", { documentTotal: formatALL(doc.total) })}</span>
          </div>
        )}

        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("fiscalPdf")}</div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="size-4" />
            {file ? file.name : t("fiscalPdfPick")}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
          {t("fiscalSave")}
        </Button>
      </EntityDrawer.Footer>
    </>
  );
}
