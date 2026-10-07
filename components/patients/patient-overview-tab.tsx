"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, TriangleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { MoneyAmount } from "@/components/money-amount";
import { recentVisits, totalPaid } from "@/lib/patient-billing";
import { formatDate, formatDateTime } from "@/lib/patient-format";
import { EditPatientDrawer } from "@/components/patients/edit-patient-drawer";

function genderLabel(
  t: ReturnType<typeof useTranslations<"PatientRecord">>,
  gender: Doc<"patients">["gender"],
): string {
  if (gender === "male") return t("genderMale");
  if (gender === "female") return t("genderFemale");
  if (gender === "other") return t("genderOther");
  return "—";
}

export function PatientOverviewTab({ patient }: { patient: Doc<"patients"> }) {
  const t = useTranslations("PatientRecord");
  const locale = useLocale();
  const [editing, setEditing] = React.useState(false);

  const appointments = useQuery(api.appointments.listAppointmentsForPatient, { patientId: patient._id });
  const charges = useQuery(api.billing.charges.listChargesForPatient, { patientId: patient._id });
  const payments = useQuery(api.billing.payments.listPaymentsForPatient, { patientId: patient._id });

  // Lazy initializer: React calls this exactly once, at mount, which is the
  // accepted pattern for a one-time impure read (same as reading
  // localStorage in useState(() => ...)).
  const [now] = React.useState(() => Date.now());

  const visitsCount = appointments?.filter((a) => a.status === "completed").length ?? 0;
  const lifetimePaid = payments ? totalPaid(payments) : 0;
  const nextAppointment = appointments
    ?.filter((a) => (a.status === "booked" || a.status === "confirmed") && a.start > now)
    .sort((a, b) => a.start - b.start)[0];
  const visits = charges && payments && appointments ? recentVisits(charges, payments, appointments) : [];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_360px] items-start">
      <div className="flex flex-col gap-5">
        <div className="rounded-[14px] border border-border bg-card p-[18px]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14.5px] font-semibold">{t("detailsTitle")}</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> {t("edit")}
            </Button>
          </div>
          <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 text-[13.5px]">
            <dt className="text-muted-foreground">{t("fullName")}</dt>
            <dd>
              {patient.firstName} {patient.lastName}
            </dd>
            <dt className="text-muted-foreground">{t("sex")}</dt>
            <dd>{genderLabel(t, patient.gender)}</dd>
            <dt className="text-muted-foreground">{t("email")}</dt>
            <dd>{patient.email ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("address")}</dt>
            <dd>{patient.address ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("referredBy")}</dt>
            <dd>{patient.referralSource ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("language")}</dt>
            <dd>{patient.language === "sq" ? "Shqip" : "English"}</dd>
          </dl>
        </div>

        {patient.tags && patient.tags.length > 0 && (
          <div className="rounded-[14px] border border-status-cancel/25 bg-status-cancel-bg p-[18px]">
            <h3 className="mb-2.5 flex items-center gap-2 text-[14.5px] font-semibold text-status-cancel">
              <TriangleAlert className="size-4" /> {t("medicalAlertsTitle")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {patient.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-status-cancel"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[14px] border border-border bg-card p-[18px]">
          <h3 className="mb-3 text-[14.5px] font-semibold">{t("recentVisitsTitle")}</h3>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("recentVisitsEmpty")}</p>
          ) : (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="pb-2 font-semibold">{t("colDate")}</th>
                  <th className="pb-2 font-semibold">{t("colService")}</th>
                  <th className="pb-2 font-semibold">{t("colPractitioner")}</th>
                  <th className="pb-2 font-semibold">{t("colStatus")}</th>
                  <th className="pb-2 text-right font-semibold">{t("colCharged")}</th>
                  <th className="pb-2 text-right font-semibold">{t("colPaid")}</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.charge._id} className="border-t border-border">
                    <td className="py-2.5 tabular-nums">{formatDate(v.date, locale)}</td>
                    <td className="py-2.5">{v.charge.description}</td>
                    <td className="py-2.5">{v.appointment?.practitionerName ?? "—"}</td>
                    <td className="py-2.5">
                      {v.appointment ? <AppointmentStatusBadge status={v.appointment.status} /> : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <MoneyAmount amount={v.charge.amount} />
                    </td>
                    <td className="py-2.5 text-right">
                      <MoneyAmount amount={v.paid} tone="positive" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="rounded-[14px] border border-border bg-card p-[18px]">
          <h3 className="mb-2.5 text-[14.5px] font-semibold">{t("nextAppointmentTitle")}</h3>
          {nextAppointment ? (
            <div className="flex items-start gap-3">
              <div className="flex w-12 flex-col items-center rounded-lg border border-border py-1.5 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", { month: "short" })
                    .format(new Date(nextAppointment.start))
                    .toUpperCase()}
                </span>
                <span className="text-base font-bold">{new Date(nextAppointment.start).getDate()}</span>
              </div>
              <div className="grow">
                <div className="text-sm font-semibold">{nextAppointment.serviceName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(nextAppointment.start, locale)} · {nextAppointment.practitionerName}
                </div>
              </div>
              <AppointmentStatusBadge status={nextAppointment.status} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label={t("statsVisits")} value={visitsCount} />
          <StatTile label={t("statsLifetimePaid")} value={<MoneyAmount amount={lifetimePaid} />} />
          <StatTile label={t("statsNoShows")} value={patient.noShowCount ?? 0} />
        </div>
      </div>

      {editing && <EditPatientDrawer patient={patient} onClose={() => setEditing(false)} />}
    </div>
  );
}
