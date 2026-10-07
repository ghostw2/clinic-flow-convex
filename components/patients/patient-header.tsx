"use client";

import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarPlus, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BalanceCard } from "@/components/balance-card";
import { avatarTint, initials } from "@/lib/format";
import { ageFromDob, formatDate } from "@/lib/patient-format";
import type { OpenCharge } from "@/lib/patient-billing";

export function PatientHeader({
  patient,
  openChargeSummary,
}: {
  patient: Doc<"patients">;
  openChargeSummary: { total: number; charges: OpenCharge[] };
}) {
  const t = useTranslations("PatientRecord");
  const locale = useLocale();
  const name = `${patient.firstName} ${patient.lastName}`;
  const age = ageFromDob(patient.dob);
  const payInFullCash = useMutation(api.billing.payments.payInFullCash);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <Avatar size="lg" className={avatarTint(patient._id)}>
          <AvatarFallback className={avatarTint(patient._id)}>{initials(name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-xl font-bold tracking-tight">{name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{patient.phone}</span>
            {patient.dob !== undefined && (
              <span>
                {formatDate(patient.dob, locale)} · {age}
                {locale === "sq" ? " vjeç" : "y"}
              </span>
            )}
            {patient.nid && <span>NID {patient.nid}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <BalanceCard
          balance={patient.balance}
          label={patient.balance > 0 ? t("balanceOwed") : t("balanceClear")}
          subtext={t("ofOpenCharge", {
            amount: `ALL ${openChargeSummary.total.toLocaleString("en-US")}`,
            count: openChargeSummary.charges.length,
          })}
        />
        <div className="flex flex-col gap-2">
          {patient.balance > 0 && (
            <Button
              className="h-10"
              onClick={() => payInFullCash({ patientId: patient._id })}
            >
              <Wallet className="size-4" /> {t("recordPayment")}
            </Button>
          )}
          <Button variant="outline" className="h-10" disabled>
            <CalendarPlus className="size-4" /> {t("book")}
          </Button>
        </div>
      </div>
    </div>
  );
}
