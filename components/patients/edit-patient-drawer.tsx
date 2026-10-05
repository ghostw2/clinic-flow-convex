"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/chip";
import { Button } from "@/components/ui/button";

type Gender = "male" | "female" | "other";

function dobToInput(dob: number | undefined): string {
  return dob ? new Date(dob).toISOString().slice(0, 10) : "";
}

// Spec Sec5: patient record fields (name, DOB, gender, NID, phone, email,
// address, emergency contact, referral source, tags, internal notes,
// preferred language). The backend (patients.updatePatient) has supported
// every one of these since early in the build; the Overview tab's own
// "Edit" button has sat there `disabled` the whole time, per its own
// comment pointing at this exact drawer as the planned follow-up.
export function EditPatientDrawer({
  patient,
  onClose,
}: {
  patient: Doc<"patients">;
  onClose: () => void;
}) {
  const t = useTranslations("PatientRecord");
  const updatePatient = useMutation(api.patients.updatePatient);

  const [firstName, setFirstName] = React.useState(patient.firstName);
  const [lastName, setLastName] = React.useState(patient.lastName);
  const [dob, setDob] = React.useState(dobToInput(patient.dob));
  const [gender, setGender] = React.useState<Gender | "">(patient.gender ?? "");
  const [nid, setNid] = React.useState(patient.nid ?? "");
  const [phone, setPhone] = React.useState(patient.phone);
  const [email, setEmail] = React.useState(patient.email ?? "");
  const [address, setAddress] = React.useState(patient.address ?? "");
  const [emergencyName, setEmergencyName] = React.useState(patient.emergencyContact?.name ?? "");
  const [emergencyPhone, setEmergencyPhone] = React.useState(patient.emergencyContact?.phone ?? "");
  const [referralSource, setReferralSource] = React.useState(patient.referralSource ?? "");
  const [tagsText, setTagsText] = React.useState((patient.tags ?? []).join(", "));
  const [notes, setNotes] = React.useState(patient.notes ?? "");
  const [language, setLanguage] = React.useState<"sq" | "en">(patient.language);
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit =
    firstName.trim().length > 0 && lastName.trim().length > 0 && phone.trim().length > 0 && !submitting;

  async function handleSave() {
    setSubmitting(true);
    try {
      const tags = tagsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await updatePatient({
        patientId: patient._id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: dob ? new Date(dob).getTime() : undefined,
        gender: gender || undefined,
        nid: nid.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContact:
          emergencyName.trim() && emergencyPhone.trim()
            ? { name: emergencyName.trim(), phone: emergencyPhone.trim() }
            : undefined,
        referralSource: referralSource.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        language,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={t("editPatientTitle")} onClose={onClose} />
      <EntityDrawer.Body className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("firstName")} htmlFor="ep-first">
            <Input id="ep-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </FormField>
          <FormField label={t("lastName")} htmlFor="ep-last">
            <Input id="ep-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("dob")} htmlFor="ep-dob">
            <Input id="ep-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </FormField>
          <FormField label={t("nid")} htmlFor="ep-nid">
            <Input id="ep-nid" value={nid} onChange={(e) => setNid(e.target.value)} />
          </FormField>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("sex")}</div>
          <Segmented
            value={gender}
            onValueChange={(v) => setGender(v as Gender)}
            options={[
              { value: "male", label: t("genderMale") },
              { value: "female", label: t("genderFemale") },
              { value: "other", label: t("genderOther") },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("phone")} htmlFor="ep-phone">
            <Input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          <FormField label={t("email")} htmlFor="ep-email">
            <Input id="ep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
        </div>
        <FormField label={t("address")} htmlFor="ep-address">
          <Input id="ep-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("emergencyContactName")} htmlFor="ep-ec-name">
            <Input id="ep-ec-name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
          </FormField>
          <FormField label={t("emergencyContactPhone")} htmlFor="ep-ec-phone">
            <Input id="ep-ec-phone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          </FormField>
        </div>
        <FormField label={t("referredBy")} htmlFor="ep-referral">
          <Input id="ep-referral" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} />
        </FormField>
        <FormField label={t("tags")} htmlFor="ep-tags" hint={t("tagsHint")}>
          <Input id="ep-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </FormField>
        <FormField label={t("notes")} htmlFor="ep-notes">
          <textarea
            id="ep-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </FormField>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("language")}</div>
          <Segmented
            value={language}
            onValueChange={(v) => setLanguage(v as "sq" | "en")}
            options={[
              { value: "sq", label: "Shqip" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        <Button className="w-full" disabled={!canSubmit} onClick={handleSave}>
          {t("save")}
        </Button>
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}
