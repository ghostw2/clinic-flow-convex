"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatTile } from "@/components/stat-tile";
import { MoneyAmount } from "@/components/money-amount";
import { avatarTint, initials } from "@/lib/format";
import { formatDateTime } from "@/lib/patient-format";
import { ReportsTab } from "@/components/finances/reports-tab";
import { FiscalWorklistTab } from "@/components/finances/fiscal-worklist";

type Tab = "today" | "outstanding" | "fiscal" | "reports";

export default function FinancesPage() {
  const t = useTranslations("Finances");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "today";

  const payments = useQuery(api.billing.payments.listPaymentsTodayWithNames);
  const debtors = useQuery(api.patients.listTopDebtors, { limit: 50 });
  const segmentCounts = useQuery(api.patients.patientSegmentCounts);

  const totals = React.useMemo(() => {
    const byMethod = { cash: 0, card: 0, transfer: 0, other: 0 };
    for (const p of payments ?? []) {
      byMethod[p.method] += p.amount;
    }
    const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
    return { ...byMethod, total };
  }, [payments]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "today", label: t("today") },
    { key: "outstanding", label: t("outstanding"), count: segmentCounts?.owesMoney },
    { key: "fiscal", label: t("receipts") },
    { key: "reports", label: t("reports") },
  ];

  return (
    <AppShell
      topbar={
        <>
          <h1 className="text-[18px] font-semibold tracking-tight">{t("title")}</h1>
          <div className="grow" />
          <Button variant="outline" disabled title={t("comingSoon")}>
            <Download className="size-4" /> {t("export")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-4 pt-4 md:px-0 md:pt-0">
        <div className="flex gap-5 overflow-x-auto border-b border-border">
          {tabs.map((tabItem) => (
            <Link
              key={tabItem.key}
              href={`/finances?tab=${tabItem.key}`}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[13.5px] font-semibold whitespace-nowrap ${
                tab === tabItem.key
                  ? "border-brand-700 text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tabItem.label}
              {!!tabItem.count && (
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {tabItem.count}
                </span>
              )}
            </Link>
          ))}
        </div>

        {tab === "today" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t("cash")} value={<MoneyAmount amount={totals.cash} />} />
              <StatTile label={t("card")} value={<MoneyAmount amount={totals.card} />} />
              <StatTile label={t("bankTransfer")} value={<MoneyAmount amount={totals.transfer} />} />
              <StatTile label={t("totalCollected")} value={<MoneyAmount amount={totals.total} tone="positive" />} />
            </div>

            <div className="overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
                <h3 className="text-[14.5px] font-semibold">{t("todaysPayments")}</h3>
              </div>
              {!payments || payments.length === 0 ? (
                <p className="p-[18px] text-sm text-muted-foreground">{t("noPaymentsToday")}</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="bg-muted/40 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                      <th className="px-[18px] py-2.5">{t("colTime")}</th>
                      <th className="py-2.5">{t("colPatient")}</th>
                      <th className="py-2.5">{t("colMethod")}</th>
                      <th className="px-[18px] py-2.5 text-right">{t("colAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id} className="border-t border-border">
                        <td className="px-[18px] py-3 tabular-nums">
                          {formatDateTime(p.receivedAt, locale).split(",")[1]?.trim() ??
                            formatDateTime(p.receivedAt, locale)}
                        </td>
                        <td className="py-3">
                          <Link href={`/patients/${p.patientId}`} className="flex items-center gap-2.5 hover:underline">
                            <Avatar size="sm" className={avatarTint(p.patientId)}>
                              <AvatarFallback className={avatarTint(p.patientId)}>
                                {initials(p.patientName)}
                              </AvatarFallback>
                            </Avatar>
                            {p.patientName}
                          </Link>
                        </td>
                        <td className="py-3 capitalize">{p.method}</td>
                        <td className="px-[18px] py-3 text-right">
                          <MoneyAmount amount={p.amount} tone={p.amount < 0 ? "negative" : "positive"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "outstanding" && (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
              <h3 className="text-[14.5px] font-semibold">{t("outstanding")}</h3>
              <MoneyAmount amount={segmentCounts?.owesMoneyTotal ?? 0} tone="negative" className="text-base" />
            </div>
            {!debtors || debtors.length === 0 ? (
              <p className="p-[18px] text-sm text-muted-foreground">{t("noOutstanding")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {debtors.map((p) => (
                  <li key={p._id}>
                    <Link
                      href={`/patients/${p._id}`}
                      className="flex items-center gap-2.5 px-[18px] py-3 hover:bg-muted/40"
                    >
                      <Avatar size="sm" className={avatarTint(p._id)}>
                        <AvatarFallback className={avatarTint(p._id)}>
                          {initials(`${p.firstName} ${p.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="grow">
                        <span className="block text-sm font-semibold">
                          {p.firstName} {p.lastName}
                        </span>
                      </span>
                      <MoneyAmount amount={p.balance} tone="negative" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "reports" && <ReportsTab />}

        {tab === "fiscal" && <FiscalWorklistTab />}
      </div>
    </AppShell>
  );
}
