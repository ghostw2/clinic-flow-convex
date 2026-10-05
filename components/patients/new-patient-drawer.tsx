"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { EntityDrawer } from "@/components/entity-drawer";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// frame 15's FormField error-state anatomy, driven by the existing
// checkDuplicate query -- no new backend behaviour, just wiring it up.
export function NewPatientDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Patients");
  const router = useRouter();
  const createPatient = useMutation(api.patients.createPatient);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [nid, setNid] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [checkedPhone, setCheckedPhone] = React.useState("");
  const [checkedNid, setCheckedNid] = React.useState("");
  const duplicates = useQuery(
    api.patients.checkDuplicate,
    checkedPhone || checkedNid ? { phone: checkedPhone || undefined, nid: checkedNid || undefined } : "skip",
  );
  const hasDuplicate = (duplicates?.length ?? 0) > 0;

  function reset() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setNid("");
    setEmail("");
    setCheckedPhone("");
    setCheckedNid("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { patientId } = await createPatient({
        firstName,
        lastName,
        phone,
        nid: nid || undefined,
        email: email || undefined,
        language: "sq",
      });
      onOpenChange(false);
      reset();
      router.push(`/patients/${patientId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDrawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <EntityDrawer.Header title={t("newPatient")} onClose={() => onOpenChange(false)} />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <EntityDrawer.Body className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("firstName")} required htmlFor="np-first">
              <Input id="np-first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </FormField>
            <FormField label={t("lastName")} required htmlFor="np-last">
              <Input id="np-last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </FormField>
          </div>
          <FormField
            label={t("phone")}
            required
            htmlFor="np-phone"
            hint={!hasDuplicate ? t("phoneHint") : undefined}
            error={
              hasDuplicate ? (
                <>
                  {t("duplicateMatches", {
                    name: `${duplicates![0].firstName} ${duplicates![0].lastName}`,
                  })}{" "}
                  <Link href={`/patients/${duplicates![0]._id}`} className="font-bold underline">
                    {t("openRecord")}
                  </Link>
                </>
              ) : undefined
            }
          >
            <Input
              id="np-phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setCheckedPhone(phone)}
              aria-invalid={hasDuplicate}
            />
          </FormField>
          <FormField label={t("nid")} htmlFor="np-nid">
            <Input
              id="np-nid"
              value={nid}
              onChange={(e) => setNid(e.target.value)}
              onBlur={() => setCheckedNid(nid)}
            />
          </FormField>
          <FormField label={t("email")} htmlFor="np-email">
            <Input id="np-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
        </EntityDrawer.Body>
        <EntityDrawer.Footer>
          <Button type="submit" disabled={submitting || !firstName || !lastName || !phone} className="w-full">
            {t("createPatient")}
          </Button>
        </EntityDrawer.Footer>
      </form>
    </EntityDrawer>
  );
}
