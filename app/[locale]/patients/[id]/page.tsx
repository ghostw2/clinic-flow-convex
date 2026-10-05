"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { cn } from "cn";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientHeader } from "@/components/patients/patient-header";
import { PatientOverviewTab } from "@/components/patients/patient-overview-tab";
import { PatientBillingTab } from "@/components/patients/patient-billing-tab";
import { PatientClinicalTab } from "@/components/patients/patient-clinical-tab";
import { PatientCoursesTab } from "@/components/patients/patient-courses-tab";
import { openCharges } from "@/lib/patient-billing";

type Tab = "overview" | "appointments" | "clinical" | "courses" | "billing" | "files";

export default function PatientRecordPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const t = useTranslations("PatientRecord");
  const tab = (searchParams.get("tab") as Tab | null) ?? "overview";

  const patientId = params.id as Id<"patients">;
  const patient = useQuery(api.patients.getPatient, { patientId });
  const charges = useQuery(api.billing.charges.listChargesForPatient, { patientId });
  const payments = useQuery(api.billing.payments.listPaymentsForPatient, { patientId });
  const appointments = useQuery(api.appointments.listAppointmentsForPatient, { patientId });

  const logAccess = useMutation(api.patients.logPatientAccess);
  React.useEffect(() => {
    void logAccess({ patientId });
    // Intentionally fires once per patientId, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  if (patient === null) {
    return (
      <AppShell topbar={<span className="text-[18px] font-semibold">{t("notFound")}</span>}>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-lg font-semibold">{t("notFound")}</p>
          <p className="text-sm text-muted-foreground">{t("notFoundHint")}</p>
          <Link href="/patients" className="text-sm font-semibold text-primary">
            {t("backToPatients")}
          </Link>
        </div>
      </AppShell>
    );
  }

  if (patient === undefined) {
    return (
      <AppShell topbar={<div className="h-4 w-32 animate-pulse rounded bg-muted" />}>
        <div className="h-40 animate-pulse rounded-[14px] bg-muted" />
      </AppShell>
    );
  }

  const openList = charges && payments ? openCharges(charges, payments) : [];
  const openSummary = {
    total: openList.reduce((sum, c) => sum + c.charge.amount, 0),
    charges: openList,
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: t("tabOverview") },
    { key: "appointments", label: t("tabAppointments"), count: appointments?.length },
    { key: "clinical", label: t("tabClinical") },
    { key: "courses", label: t("tabCourses") },
    { key: "billing", label: t("tabBilling"), count: openSummary.charges.length || undefined },
    { key: "files", label: t("tabFiles") },
  ];

  return (
    <AppShell
      topbar={
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/patients" className="hover:text-foreground">
            {t("backToPatients")}
          </Link>
          <span>/</span>
          <span className="font-semibold text-foreground">
            {patient.firstName} {patient.lastName}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <PatientHeader patient={patient} openChargeSummary={openSummary} />

        <div className="flex gap-5 border-b border-border">
          {tabs.map((tabItem) => (
            <Link
              key={tabItem.key}
              href={`/patients/${patientId}?tab=${tabItem.key}`}
              className={cn(
                "flex items-center gap-1.5 border-b-2 pb-2.5 text-[13.5px] font-semibold",
                tab === tabItem.key
                  ? "border-brand-700 text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
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

        {tab === "overview" && <PatientOverviewTab patient={patient} />}
        {tab === "clinical" && <PatientClinicalTab patientId={patientId} />}
        {tab === "courses" && <PatientCoursesTab patientId={patientId} />}
        {tab === "billing" && <PatientBillingTab patient={patient} />}
        {(tab === "appointments" || tab === "files") && (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-border py-16 text-center">
            <p className="font-semibold">{t("comingSoonTab")}</p>
            <p className="text-sm text-muted-foreground">{t("comingSoonTabHint")}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
