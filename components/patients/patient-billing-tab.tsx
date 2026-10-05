"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Clock, FileText, FilePlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Segmented } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";
import { MoneyAmount } from "@/components/money-amount";
import { buildLedger, openCharges, totalCharged, totalPaid } from "@/lib/patient-billing";
import { formatDate } from "@/lib/patient-format";
import { PaymentPlanCard } from "@/components/patients/payment-plan-card";
import { DocumentGeneratorDialog } from "@/components/patients/document-generator-dialog";
import { GeneratedDocumentModal } from "@/components/patients/generated-document-modal";

type LedgerFilter = "all" | "charges" | "payments";

export function PatientBillingTab({ patient }: { patient: Doc<"patients"> }) {
  const t = useTranslations("PatientRecord");
  const locale = useLocale();
  const [filter, setFilter] = React.useState<LedgerFilter>("all");
  const [generatorOpen, setGeneratorOpen] = React.useState(false);
  const [viewingDocId, setViewingDocId] = React.useState<Id<"documents"> | null>(null);

  const charges = useQuery(api.billing.charges.listChargesForPatient, { patientId: patient._id });
  const payments = useQuery(api.billing.payments.listPaymentsForPatient, { patientId: patient._id });
  const documents = useQuery(api.billing.documents.listDocumentsForPatient, { patientId: patient._id });
  const appointments = useQuery(api.appointments.listAppointmentsForPatient, { patientId: patient._id });

  // See PatientOverviewTab for why this uses a lazy useState initializer.
  const [now] = React.useState(() => Date.now());
  const upcoming = appointments
    ?.filter((a) => (a.status === "booked" || a.status === "confirmed") && a.start > now)
    .sort((a, b) => a.start - b.start)[0];

  const ledger = charges && payments ? buildLedger(charges, payments, upcoming) : [];
  const filteredLedger = ledger.filter((row) => {
    if (filter === "charges") return row.kind === "charge";
    if (filter === "payments") return row.kind === "payment";
    return true;
  });
  const open = charges && payments ? openCharges(charges, payments) : [];
  const primaryOpen = open[0];

  return (
    <div className="grid grid-cols-[1fr_320px] items-start gap-5">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label={t("totalCharged")} value={<MoneyAmount amount={charges ? totalCharged(charges) : 0} />} />
          <StatTile
            label={t("totalPaid")}
            value={<MoneyAmount amount={payments ? totalPaid(payments) : 0} tone="positive" />}
          />
          <StatTile
            label={t("balance")}
            value={<MoneyAmount amount={patient.balance} tone={patient.balance > 0 ? "negative" : "muted"} />}
          />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
            <h3 className="text-[14.5px] font-semibold">{t("ledgerTitle")}</h3>
            <Segmented
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: "all", label: t("ledgerAll") },
                { value: "charges", label: t("ledgerCharges") },
                { value: "payments", label: t("ledgerPayments") },
              ]}
            />
          </div>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-muted/40 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-[18px] py-2.5">{t("colDate")}</th>
                <th className="py-2.5">{t("colType")}</th>
                <th className="py-2.5">{t("colDescription")}</th>
                <th className="py-2.5 text-right">{t("colCharge")}</th>
                <th className="py-2.5 text-right">{t("colPayment")}</th>
                <th className="px-[18px] py-2.5 text-right">{t("colRunningBalance")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((row) => {
                if (row.kind === "upcoming") {
                  return (
                    <tr key={`upcoming-${row.appointment._id}`} className="border-t border-border bg-muted/20 text-muted-foreground">
                      <td className="px-[18px] py-3 tabular-nums">{formatDate(row.date, locale)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          <Clock className="size-3" /> {t("ledgerUpcoming")}
                        </span>
                      </td>
                      <td className="py-3">{row.appointment.serviceName}</td>
                      <td className="py-3 text-right" colSpan={2}>
                        {t("ledgerScheduled")}
                      </td>
                      <td className="px-[18px] py-3" />
                    </tr>
                  );
                }
                if (row.kind === "charge") {
                  return (
                    <tr key={row.charge._id} className="border-t border-border">
                      <td className="px-[18px] py-3 tabular-nums">{formatDate(row.date, locale)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-booked-bg px-2 py-0.5 text-xs font-medium text-status-booked">
                          <ArrowUpRight className="size-3" /> {t("ledgerCharge")}
                        </span>
                      </td>
                      <td className="py-3">{row.charge.description}</td>
                      <td className="py-3 text-right">
                        <MoneyAmount amount={row.charge.amount} />
                      </td>
                      <td className="py-3" />
                      <td className="px-[18px] py-3 text-right">
                        <MoneyAmount amount={row.runningBalance} />
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.payment._id} className="border-t border-border">
                    <td className="px-[18px] py-3 tabular-nums">{formatDate(row.date, locale)}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-done-bg px-2 py-0.5 text-xs font-medium text-status-done">
                        <ArrowDownLeft className="size-3" /> {t("ledgerPayment")}
                      </span>
                    </td>
                    <td className="py-3 capitalize">{row.payment.method}</td>
                    <td className="py-3" />
                    <td className="py-3 text-right">
                      <MoneyAmount amount={row.payment.amount} tone="positive" />
                    </td>
                    <td className="px-[18px] py-3 text-right">
                      <MoneyAmount amount={row.runningBalance} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <PaymentPlanCard patient={patient} />

        {primaryOpen && (
          <div className="rounded-[14px] border border-border bg-card p-[18px]">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[14.5px] font-semibold">{t("openChargeTitle")}</h3>
              <span className="rounded-full bg-status-noshow-bg px-2 py-0.5 text-xs font-medium text-status-noshow">
                {t("partiallyPaid")}
              </span>
            </div>
            <div className="text-sm font-semibold">{primaryOpen.charge.description}</div>
            <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-status-noshow"
                style={{ width: `${Math.min(100, (primaryOpen.paid / primaryOpen.charge.amount) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("paidLabel", { amount: `ALL ${primaryOpen.paid.toLocaleString("en-US")}` })}</span>
              <span className="font-semibold text-foreground">
                {t("leftLabel", { amount: `ALL ${primaryOpen.remaining.toLocaleString("en-US")}` })}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-[14px] border border-border bg-card p-[18px]">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-[14.5px] font-semibold">{t("documentsTitle")}</h3>
            <Button size="sm" variant="outline" onClick={() => setGeneratorOpen(true)}>
              <FilePlus className="size-3.5" /> {t("generateDocument")}
            </Button>
          </div>
          {!documents || documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("documentsEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {documents.map((doc) => (
                <li key={doc._id}>
                  <button
                    type="button"
                    onClick={() => setViewingDocId(doc._id)}
                    className="flex w-full items-center gap-2.5 rounded-lg text-left hover:bg-muted/40"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </div>
                    <div className="grow">
                      <div className="text-sm font-semibold">
                        {doc.number}
                        {doc.voidedAt !== undefined && (
                          <span className="ml-1.5 text-xs font-normal text-status-cancel">({t("voided")})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(doc.issuedAt, locale)} · ALL {doc.total.toLocaleString("en-US")}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {generatorOpen && (
        <DocumentGeneratorDialog patientId={patient._id} onClose={() => setGeneratorOpen(false)} />
      )}
      {viewingDocId && (
        <GeneratedDocumentModal documentId={viewingDocId} onDone={() => setViewingDocId(null)} />
      )}
    </div>
  );
}
