"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/chip";
import { StatTile } from "@/components/stat-tile";
import { MoneyAmount } from "@/components/money-amount";
import { addDays, startOfDay } from "@/lib/calendar";

type Preset = "thisMonth" | "lastMonth" | "thisYear" | "custom";

function toDateInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeForPreset(preset: Preset): { start: number; end: number } {
  const now = Date.now();
  const today = startOfDay(now);
  const d = new Date(today);
  if (preset === "thisMonth") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return { start, end: addDays(today, 1) };
  }
  if (preset === "lastMonth") {
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return { start, end };
  }
  if (preset === "thisYear") {
    const start = new Date(d.getFullYear(), 0, 1).getTime();
    return { start, end: addDays(today, 1) };
  }
  return { start: addDays(today, -30), end: addDays(today, 1) };
}

// Spec Sec10: "Revenue by period / service / payment method, new vs
// returning patients, no-show rate, course acceptance rate, installment
// collection rate. Date range picker, CSV export for the accountant."
export function ReportsTab() {
  const t = useTranslations("Finances");
  const [preset, setPreset] = React.useState<Preset>("thisMonth");
  const initial = React.useMemo(() => rangeForPreset("thisMonth"), []);
  const [startInput, setStartInput] = React.useState(toDateInput(initial.start));
  const [endInput, setEndInput] = React.useState(toDateInput(initial.end));

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") {
      const r = rangeForPreset(next);
      setStartInput(toDateInput(r.start));
      setEndInput(toDateInput(r.end));
    }
  }

  const startDate = new Date(startInput).getTime();
  const endDate = new Date(endInput).getTime() + 24 * 60 * 60 * 1000; // inclusive end day

  const financial = useQuery(api.reports.getFinancialReport, { startDate, endDate });
  const operations = useQuery(api.reports.getOperationsReport, { startDate, endDate });

  function handleExportCsv() {
    if (!financial || !operations) return;
    const rows: string[][] = [
      [t("reportRangeLabel"), `${startInput} -> ${endInput}`],
      [],
      [t("totalCollected"), String(financial.totalCollected)],
      [t("totalCharged"), String(financial.totalCharged)],
      [],
      [t("byMethod")],
      ...Object.entries(financial.byMethod).map(([method, amount]) => [method, String(amount)]),
      [],
      [t("byService")],
      ...financial.byService.map((s) => [s.description, String(s.amount)]),
      [],
      [t("noShowRate"), operations.noShowRate !== null ? `${(operations.noShowRate * 100).toFixed(1)}%` : "-"],
      [
        t("courseAcceptanceRate"),
        operations.courseAcceptanceRate !== null ? `${(operations.courseAcceptanceRate * 100).toFixed(1)}%` : "-",
      ],
      [
        t("installmentCollectionRate"),
        operations.installmentCollectionRate !== null
          ? `${(operations.installmentCollectionRate * 100).toFixed(1)}%`
          : "-",
      ],
      [t("newPatients"), String(operations.newPatients)],
      [t("returningPatients"), String(operations.returningPatients)],
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${startInput}-to-${endInput}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatRate(rate: number | null): string {
    return rate !== null ? `${(rate * 100).toFixed(0)}%` : "-";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={preset}
          onValueChange={(v) => applyPreset(v as Preset)}
          options={[
            { value: "thisMonth", label: t("thisMonth") },
            { value: "lastMonth", label: t("lastMonth") },
            { value: "thisYear", label: t("thisYear") },
            { value: "custom", label: t("custom") },
          ]}
        />
        <Input
          type="date"
          value={startInput}
          onChange={(e) => {
            setPreset("custom");
            setStartInput(e.target.value);
          }}
          className="w-36"
        />
        <span className="text-sm text-muted-foreground">-&gt;</span>
        <Input
          type="date"
          value={endInput}
          onChange={(e) => {
            setPreset("custom");
            setEndInput(e.target.value);
          }}
          className="w-36"
        />
        <div className="grow" />
        <Button variant="outline" disabled={!financial || !operations} onClick={handleExportCsv}>
          <Download className="size-4" /> {t("exportCsv")}
        </Button>
      </div>

      {!financial || !operations ? (
        <div className="h-64 animate-pulse rounded-[14px] bg-muted" />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <StatTile label={t("totalCollected")} value={<MoneyAmount amount={financial.totalCollected} tone="positive" />} />
            <StatTile label={t("totalCharged")} value={<MoneyAmount amount={financial.totalCharged} />} />
            <StatTile label={t("newPatients")} value={operations.newPatients} />
            <StatTile label={t("returningPatients")} value={operations.returningPatients} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatTile label={t("noShowRate")} value={formatRate(operations.noShowRate)} />
            <StatTile label={t("courseAcceptanceRate")} value={formatRate(operations.courseAcceptanceRate)} />
            <StatTile label={t("installmentCollectionRate")} value={formatRate(operations.installmentCollectionRate)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="border-b border-border px-[18px] py-3.5">
                <h3 className="text-[14.5px] font-semibold">{t("byMethod")}</h3>
              </div>
              {Object.keys(financial.byMethod).length === 0 ? (
                <p className="p-[18px] text-sm text-muted-foreground">{t("noData")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {Object.entries(financial.byMethod).map(([method, amount]) => (
                    <li key={method} className="flex items-center justify-between px-[18px] py-2.5 text-sm">
                      <span className="capitalize">{method}</span>
                      <MoneyAmount amount={amount} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="border-b border-border px-[18px] py-3.5">
                <h3 className="text-[14.5px] font-semibold">{t("byService")}</h3>
              </div>
              {financial.byService.length === 0 ? (
                <p className="p-[18px] text-sm text-muted-foreground">{t("noData")}</p>
              ) : (
                <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                  {financial.byService.map((s) => (
                    <li key={s.description} className="flex items-center justify-between px-[18px] py-2.5 text-sm">
                      <span className="truncate">{s.description}</span>
                      <MoneyAmount amount={s.amount} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
