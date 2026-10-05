"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarTint, initials } from "@/lib/format";

type Mode = "appointment" | "walkIn";

export function NewAppointmentDrawer({
  open,
  onOpenChange,
  mode,
  practitioners,
  defaultStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  practitioners: Doc<"users">[];
  defaultStart: number;
}) {
  const t = useTranslations("Calendar");

  const [patientSearch, setPatientSearch] = React.useState("");
  const [selectedPatient, setSelectedPatient] = React.useState<Doc<"patients"> | null>(null);
  const [practitionerId, setPractitionerId] = React.useState<Id<"users"> | "">(
    practitioners[0]?._id ?? "",
  );
  const [serviceId, setServiceId] = React.useState<Id<"services"> | "">("");
  const [startValue, setStartValue] = React.useState(() => toLocalInputValue(defaultStart));
  const [submitting, setSubmitting] = React.useState(false);

  const services = useQuery(api.services.listServices, { activeOnly: true });
  const searchResults = useQuery(
    api.patients.searchPatients,
    patientSearch.trim() ? { term: patientSearch.trim() } : "skip",
  );
  const createAppointment = useMutation(api.appointments.createAppointment);
  const createWalkIn = useMutation(api.appointments.createWalkIn);

  function reset() {
    setPatientSearch("");
    setSelectedPatient(null);
    setServiceId("");
    setStartValue(toLocalInputValue(defaultStart));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient || !practitionerId || !serviceId) return;
    setSubmitting(true);
    try {
      if (mode === "walkIn") {
        await createWalkIn({ patientId: selectedPatient._id, practitionerId, serviceId });
      } else {
        const service = services?.find((s) => s._id === serviceId);
        const start = new Date(startValue).getTime();
        const end = start + (service?.durationMin ?? 30) * 60_000;
        await createAppointment({ patientId: selectedPatient._id, practitionerId, serviceId, start, end });
      }
      onOpenChange(false);
      reset();
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
      <EntityDrawer.Header
        title={mode === "walkIn" ? t("walkIn") : t("newAppointmentTitle")}
        onClose={() => onOpenChange(false)}
      />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <EntityDrawer.Body className="flex flex-col gap-3.5">
          <FormField label={t("patient")} required>
            {selectedPatient ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-input px-3 py-2">
                <Avatar size="sm" className={avatarTint(selectedPatient._id)}>
                  <AvatarFallback className={avatarTint(selectedPatient._id)}>
                    {initials(`${selectedPatient.firstName} ${selectedPatient.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <span className="grow text-sm font-semibold">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs font-semibold text-primary"
                >
                  {t("change")}
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder={t("patientSearchPlaceholder")}
                  className="pl-9"
                />
                {searchResults && searchResults.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-0.5 rounded-lg border border-border bg-card p-1 shadow-card-sm">
                    {searchResults.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch("");
                        }}
                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                      >
                        <Avatar size="sm" className={avatarTint(p._id)}>
                          <AvatarFallback className={avatarTint(p._id)}>
                            {initials(`${p.firstName} ${p.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FormField>

          <FormField label={t("practitioner")} required htmlFor="na-practitioner">
            <select
              id="na-practitioner"
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value as Id<"users">)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[13.5px]"
            >
              {practitioners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t("service")} required htmlFor="na-service">
            <select
              id="na-service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value as Id<"services">)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[13.5px]"
            >
              <option value="" disabled>
                {t("selectService")}
              </option>
              {services?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} · ALL {s.price.toLocaleString("en-US")}
                </option>
              ))}
            </select>
          </FormField>

          {mode === "appointment" && (
            <FormField label={t("startTime")} required htmlFor="na-start">
              <Input
                id="na-start"
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
              />
            </FormField>
          )}
        </EntityDrawer.Body>
        <EntityDrawer.Footer>
          <Button
            type="submit"
            disabled={submitting || !selectedPatient || !practitionerId || !serviceId}
            className="w-full"
          >
            {mode === "walkIn" ? t("createWalkIn") : t("createAppointment")}
          </Button>
        </EntityDrawer.Footer>
      </form>
    </EntityDrawer>
  );
}

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
