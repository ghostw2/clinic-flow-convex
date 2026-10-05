"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardCopy, Download, FileStack } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { MoneyAmount } from "@/components/money-amount";
import { formatALL } from "@/lib/format";
import { formatDateTime } from "@/lib/patient-format";
import { RecordFiscalInvoiceDrawer } from "@/components/finances/record-fiscal-invoice-drawer";
import { BulkReconcileDrawer } from "@/components/finances/bulk-reconcile-drawer";

// Spec Sec7.9: "'To fiscalize' worklist -- a Finances tab listing today's
// payments that still need entering in the portal, each with a
// copy-friendly summary block (amount, date, service description,
// patient). This turns the double entry from an invisible burden into a
// five-minute end-of-day checklist." Plus "Daily CSV export shaped for
// portal entry" -- built client-side from the same query, matching the
// established CSV pattern in ReportsTab.
export function FiscalWorklistTab() {
  const t = useTranslations("Finances");
  const locale = useLocale();
  const worklist = useQuery(api.billing.documents.listDocumentsToFiscalizeToday);
  const [recordingId, setRecordingId] = React.useState<Id<"documents"> | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);

  async function handleCopy(row: NonNullable<typeof worklist>[number]) {
    const text = [
      row.number,
      formatALL(row.total),
      formatDateTime(row.issuedAt, locale),
      row.description,
      row.patientName,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard permission can be denied by the browser; there is
      // nothing client-side to recover -- the operator just retypes.
    }
  }

  function handleExportCsv() {
    if (!worklist || worklist.length === 0) return;
    const rows: string[][] = [
      [t("fiscalColNumber"), t("fiscalColDate"), t("fiscalColPatient"), t("fiscalColDescription"), t("fiscalColAmount")],
      ...worklist.map((row) => [
        row.number,
        formatDateTime(row.issuedAt, locale),
        row.patientName,
        row.description,
        String(row.total),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `to-fiscalize-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("fiscalWorklistHint")}</p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!worklist || worklist.length === 0}
            onClick={() => setBulkOpen(true)}
          >
            <FileStack className="size-3.5" /> {t("bulkReconcile")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!worklist || worklist.length === 0}
            onClick={handleExportCsv}
          >
            <Download className="size-3.5" /> {t("exportCsv")}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        {!worklist || worklist.length === 0 ? (
          <p className="p-[18px] text-sm text-muted-foreground">{t("fiscalWorklistEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {worklist.map((row) => (
              <li key={row._id} className="flex items-center gap-3 px-[18px] py-3">
                <div className="grow">
                  <div className="text-sm font-semibold">
                    {row.number} · {row.patientName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(row.issuedAt, locale)} · {row.description}
                  </div>
                </div>
                <MoneyAmount amount={row.total} className="text-sm" />
                <Button variant="outline" size="sm" onClick={() => handleCopy(row)}>
                  <ClipboardCopy className="size-3.5" /> {t("fiscalCopy")}
                </Button>
                <Button size="sm" onClick={() => setRecordingId(row._id)}>
                  {t("fiscalRecord")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {recordingId && (
        <RecordFiscalInvoiceDrawer documentId={recordingId} onClose={() => setRecordingId(null)} />
      )}
      {bulkOpen && <BulkReconcileDrawer onClose={() => setBulkOpen(false)} />}
    </div>
  );
}
