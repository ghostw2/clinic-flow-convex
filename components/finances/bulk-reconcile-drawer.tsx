"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Circle, Loader2, Upload, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatALL } from "@/lib/format";
import { formatDate } from "@/lib/patient-format";

type RowStatus = "idle" | "submitting" | "done" | "error";

type Row = {
  file: File;
  documentId: Id<"documents"> | "";
  nivf: string;
  nslf: string;
  fiscalNumber: string;
  status: RowStatus;
};

// Spec Sec7.9.1: "Bulk reconcile screen -- the flow that actually matters.
// Nobody does this one at a time. The realistic pattern is eight invoices
// in the portal at end of day, then back to ClinicFlow." Auto-matching by
// amount/date from the PDF itself is NOT built here -- that needs PDF
// text extraction, which sits behind the same blocked QR/regex work
// (Sec7.9.1 steps 2-3: "verify the actual parameter names against a real
// invoice before coding"). This is the manual-matching version: the
// operator picks which pending document each dropped PDF belongs to,
// still far faster than opening the single-record drawer eight times.
// Per-row fields are deliberately minimal (NIVF/NSLF/fiscal number only;
// date/type/total take the matched document's own date-of-today/cash/
// total) -- a row needing a different value uses the single Record flow
// instead.
export function BulkReconcileDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Finances");
  const locale = useLocale();
  const worklist = useQuery(api.billing.documents.listDocumentsToFiscalizeToday);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const recordFiscalInvoice = useMutation(api.billing.documents.recordFiscalInvoice);

  const [rows, setRows] = React.useState<Row[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newRows: Row[] = Array.from(files).map((file) => ({
      file,
      documentId: "",
      nivf: "",
      nslf: "",
      fiscalNumber: "",
      status: "idle",
    }));
    setRows((prev) => [...prev, ...newRows]);
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const readyCount = rows.filter(
    (r) => r.documentId && r.nivf.trim() && r.nslf.trim() && r.fiscalNumber.trim() && r.status !== "done",
  ).length;

  async function handleSubmitAll() {
    setSubmitting(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.documentId || !row.nivf.trim() || !row.nslf.trim() || !row.fiscalNumber.trim()) continue;
        if (row.status === "done") continue;
        const doc = worklist?.find((d) => d._id === row.documentId);
        if (!doc) continue;

        updateRow(i, { status: "submitting" });
        try {
          const uploadUrl = await generateUploadUrl();
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": row.file.type },
            body: row.file,
          });
          const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
          await recordFiscalInvoice({
            documentId: row.documentId,
            pdfStorageId: storageId,
            nivf: row.nivf.trim(),
            nslf: row.nslf.trim(),
            fiscalNumber: row.fiscalNumber.trim(),
            fiscalDate: Date.now(),
            invoiceType: "cash",
            totalOnFiscal: doc.total,
          });
          updateRow(i, { status: "done" });
        } catch {
          updateRow(i, { status: "error" });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const allDone = rows.length > 0 && rows.every((r) => r.status === "done");

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={t("bulkReconcileTitle")} onClose={onClose} />
      <EntityDrawer.Body className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("bulkReconcileHint")}</p>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="size-4" />
          {t("bulkReconcileDrop")}
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>

        {rows.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {rows.map((row, i) => {
              const otherAssigned = new Set(
                rows.filter((_, idx) => idx !== i).map((r) => r.documentId).filter(Boolean),
              );
              return (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    {row.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-status-done" />}
                    {row.status === "error" && <XCircle className="size-4 shrink-0 text-status-cancel" />}
                    {row.status === "submitting" && <Loader2 className="size-4 shrink-0 animate-spin" />}
                    {row.status === "idle" && <Circle className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="grow truncate text-xs font-medium">{row.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={row.status === "submitting" || row.status === "done"}
                      className="text-xs text-muted-foreground hover:text-status-cancel disabled:opacity-30"
                    >
                      {t("bulkReconcileRemove")}
                    </button>
                  </div>
                  <select
                    value={row.documentId}
                    onChange={(e) => updateRow(i, { documentId: e.target.value as Id<"documents"> })}
                    disabled={row.status === "done"}
                    className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[13.5px]"
                  >
                    <option value="">{t("bulkReconcilePickDocument")}</option>
                    {(worklist ?? [])
                      .filter((d) => d._id === row.documentId || !otherAssigned.has(d._id))
                      .map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.number} · {d.patientName} · {formatALL(d.total)} · {formatDate(d.issuedAt, locale)}
                        </option>
                      ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      value={row.nivf}
                      onChange={(e) => updateRow(i, { nivf: e.target.value })}
                      placeholder={t("fiscalNivf")}
                      disabled={row.status === "done"}
                    />
                    <Input
                      value={row.nslf}
                      onChange={(e) => updateRow(i, { nslf: e.target.value })}
                      placeholder={t("fiscalNslf")}
                      disabled={row.status === "done"}
                    />
                    <Input
                      value={row.fiscalNumber}
                      onChange={(e) => updateRow(i, { fiscalNumber: e.target.value })}
                      placeholder={t("fiscalNumber")}
                      disabled={row.status === "done"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        {allDone ? (
          <Button className="w-full" onClick={onClose}>
            {t("done")}
          </Button>
        ) : (
          <Button className="w-full" disabled={readyCount === 0 || submitting} onClick={handleSubmitAll}>
            {submitting ? t("bulkReconcileSubmitting") : t("bulkReconcileSubmit", { count: readyCount })}
          </Button>
        )}
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}
