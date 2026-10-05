"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const; // Mon..Sun, 0 = Sunday (schema convention)

function minutesToInput(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function inputToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// Spec Sec13: "Our Clinic -- details, branding, NIPT, working hours." Logo
// upload ("branding") is deliberately left out of this pass -- it needs
// its own file-upload UI, and nothing in the app has one yet (spec Sec5's
// patient file uploads are also still unbuilt). Currency and clinic type
// are deliberately not exposed here either: every amount in the ledger is
// a raw number with no currency tag of its own, so changing currency
// post-launch would silently relabel existing money -- a decision for a
// real migration, not a settings toggle.
export function ClinicTab() {
  const clinic = useQuery(api.clinic.getClinic);

  if (!clinic) {
    return <div className="h-40 animate-pulse rounded-[14px] bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <ClinicDetailsCard clinic={clinic} />
      <WorkingHoursCard clinic={clinic} />
    </div>
  );
}

function ClinicDetailsCard({ clinic }: { clinic: Doc<"clinic"> }) {
  const t = useTranslations("Settings");
  const updateClinicDetails = useMutation(api.clinic.updateClinicDetails);

  const [name, setName] = React.useState(clinic.name);
  const [address, setAddress] = React.useState(clinic.address);
  const [nipt, setNipt] = React.useState(clinic.nipt);
  const [phone, setPhone] = React.useState(clinic.phone);
  const [timezone, setTimezone] = React.useState(clinic.timezone);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const dirty =
    name !== clinic.name ||
    address !== clinic.address ||
    nipt !== clinic.nipt ||
    phone !== clinic.phone ||
    timezone !== clinic.timezone;

  async function handleSave() {
    setSaving(true);
    try {
      await updateClinicDetails({ name, address, nipt, phone, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-[18px]">
      <h3 className="mb-3.5 text-[14.5px] font-semibold">{t("clinicDetails")}</h3>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("clinicName")} htmlFor="clinicName" className="col-span-2">
          <Input id="clinicName" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label={t("address")} htmlFor="address" className="col-span-2">
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormField>
        <FormField label={t("nipt")} htmlFor="nipt">
          <Input id="nipt" value={nipt} onChange={(e) => setNipt(e.target.value)} />
        </FormField>
        <FormField label={t("phone")} htmlFor="phone">
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label={t("timezone")} htmlFor="timezone">
          <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </FormField>
      </div>
      <div className="mt-3.5 flex items-center gap-2.5">
        <Button size="sm" disabled={!dirty || saving} onClick={handleSave}>
          {t("save")}
        </Button>
        {saved && <span className="text-xs text-status-done">{t("savedConfirmation")}</span>}
      </div>
    </div>
  );
}

function WorkingHoursCard({ clinic }: { clinic: Doc<"clinic"> }) {
  const t = useTranslations("Settings");
  const updateWorkingHours = useMutation(api.clinic.updateWorkingHours);

  const [hours, setHours] = React.useState(() =>
    WEEKDAYS.map((weekday) => {
      const existing = clinic.workingHours.find((h) => h.weekday === weekday);
      return existing ?? { weekday, openMin: 540, closeMin: 1080, closed: true };
    }),
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateWorkingHours({ workingHours: hours });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-[18px]">
      <h3 className="mb-3.5 text-[14.5px] font-semibold">{t("workingHours")}</h3>
      <div className="flex flex-col gap-2">
        {hours.map((h, i) => (
          <div key={h.weekday} className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5">
            <label className="flex w-28 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={!h.closed}
                onChange={(e) =>
                  setHours((prev) =>
                    prev.map((row, idx) => (idx === i ? { ...row, closed: !e.target.checked } : row)),
                  )
                }
              />
              {t(`weekday.${h.weekday}`)}
            </label>
            {h.closed ? (
              <span className="text-sm text-muted-foreground">{t("closed")}</span>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={minutesToInput(h.openMin)}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, openMin: inputToMinutes(e.target.value) } : row,
                      ),
                    )
                  }
                  className="w-28"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={minutesToInput(h.closeMin)}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, closeMin: inputToMinutes(e.target.value) } : row,
                      ),
                    )
                  }
                  className="w-28"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-2.5">
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {t("save")}
        </Button>
        {saved && <span className="text-xs text-status-done">{t("savedConfirmation")}</span>}
      </div>
    </div>
  );
}
