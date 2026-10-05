"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/patient-format";

// Spec Sec11: "Access audit log -- who opened which patient record, when.
// Change audit -- who changed what, before/after, on clinical and
// financial records." The write path (writeAudit) and the recent-rows
// query have existed since early in the build; this is the first UI that
// reads them back. Spec Sec15: "Per-clinic full data export from day one"
// -- backed by the new convex/dataExport.ts query.
export function DataTab() {
  return (
    <div className="flex flex-col gap-5">
      <ExportCard />
      <AuditLogCard />
    </div>
  );
}

function ExportCard() {
  const t = useTranslations("Settings");
  const data = useQuery(api.dataExport.exportAllData);
  const [exporting, setExporting] = React.useState(false);

  function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinicflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-[18px]">
      <h3 className="mb-1 text-[14.5px] font-semibold">{t("dataExportTitle")}</h3>
      <p className="mb-3.5 text-sm text-muted-foreground">{t("dataExportHint")}</p>
      <Button size="sm" disabled={!data || exporting} onClick={handleExport}>
        <Download className="size-3.5" /> {t("exportData")}
      </Button>
    </div>
  );
}

function AuditLogCard() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const rows = useQuery(api.audit.listAuditRecent, { limit: 100 });
  const users = useQuery(api.users.listUsers);

  const nameById = new Map<Id<"users">, string>(
    (users ?? []).map((u) => [u._id, u.name || u.email || "—"]),
  );

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="border-b border-border px-[18px] py-3.5">
        <h3 className="text-[14.5px] font-semibold">{t("auditLogTitle")}</h3>
      </div>
      {!rows || rows.length === 0 ? (
        <p className="p-[18px] text-sm text-muted-foreground">{t("auditEmpty")}</p>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-muted/40 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-[18px] py-2.5">{t("auditColWhen")}</th>
              <th className="py-2.5">{t("auditColWho")}</th>
              <th className="py-2.5">{t("auditColAction")}</th>
              <th className="px-[18px] py-2.5">{t("auditColEntity")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t border-border">
                <td className="px-[18px] py-2.5 whitespace-nowrap tabular-nums">
                  {formatDateTime(row.occurredAt, locale)}
                </td>
                <td className="py-2.5">{nameById.get(row.actorId) ?? "—"}</td>
                <td className="py-2.5 font-mono text-xs">{row.action}</td>
                <td className="px-[18px] py-2.5 text-muted-foreground">{row.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
