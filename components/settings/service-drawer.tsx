"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/form-field";

// Matches the hex values already used across convex/lib/constants.ts's
// per-clinic-type seed data, so a hand-picked colour still looks like it
// belongs next to the seeded ones.
const COLOUR_PALETTE = [
  "#4f46e5",
  "#0891b2",
  "#dc2626",
  "#f59e0b",
  "#db2777",
  "#059669",
  "#7c3aed",
  "#475569",
];

// Spec Sec13 ("Appointments -- services, durations, prices, colours,
// reminders") and Sec7.10 ("vatRate lives per service, defaulting to 0
// with an exemption reason"). Reminders aren't covered -- no comms backend
// exists yet (Phase 2 cut per the spec's own "Later" bucket).
export function ServiceDrawer({
  service,
  onClose,
}: {
  service: Doc<"services"> | null;
  onClose: () => void;
}) {
  const t = useTranslations("Settings");
  const createService = useMutation(api.services.createService);
  const updateService = useMutation(api.services.updateService);
  const setServiceActive = useMutation(api.services.setServiceActive);

  const [name, setName] = React.useState(service?.name ?? "");
  const [durationMin, setDurationMin] = React.useState(String(service?.durationMin ?? 30));
  const [price, setPrice] = React.useState(String(service?.price ?? 0));
  const [colour, setColour] = React.useState(service?.colour ?? COLOUR_PALETTE[0]);
  const [vatExempt, setVatExempt] = React.useState(service ? service.vatRate === 0 : true);
  const [vatRatePercent, setVatRatePercent] = React.useState(
    service && service.vatRate > 0 ? String(service.vatRate * 100) : "20",
  );
  const [vatExemptReason, setVatExemptReason] = React.useState(service?.vatExemptReason ?? "");
  const [active, setActive] = React.useState(service?.active ?? true);
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit =
    name.trim().length > 0 && Number(durationMin) > 0 && Number(price) >= 0 && !submitting;

  async function handleSave() {
    setSubmitting(true);
    try {
      const vatRate = vatExempt ? 0 : Number(vatRatePercent) / 100;
      const payload = {
        name: name.trim(),
        durationMin: Number(durationMin),
        price: Number(price),
        colour,
        vatRate,
        vatExemptReason: vatExempt ? vatExemptReason.trim() || undefined : undefined,
      };
      if (service) {
        await updateService({ serviceId: service._id, ...payload });
        if (active !== service.active) {
          await setServiceActive({ serviceId: service._id, active });
        }
      } else {
        await createService(payload);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={service ? t("editService") : t("newService")} onClose={onClose} />
      <EntityDrawer.Body className="flex flex-col gap-4">
        <FormField label={t("serviceName")} htmlFor="serviceName">
          <Input id="serviceName" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("duration")} htmlFor="duration">
            <Input
              id="duration"
              type="number"
              min={5}
              step={5}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </FormField>
          <FormField label={t("price")} htmlFor="price">
            <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </FormField>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("colour")}</div>
          <div className="flex flex-wrap gap-2">
            {COLOUR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColour(c)}
                aria-label={c}
                className="flex size-8 items-center justify-center rounded-full border-2"
                style={{ backgroundColor: c, borderColor: colour === c ? "var(--foreground)" : "transparent" }}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={vatExempt} onCheckedChange={(v: boolean) => setVatExempt(v)} />
          {t("vatExempt")}
        </label>

        {vatExempt ? (
          <FormField label={t("vatExemptReason")} htmlFor="vatExemptReason">
            <Input
              id="vatExemptReason"
              value={vatExemptReason}
              onChange={(e) => setVatExemptReason(e.target.value)}
            />
          </FormField>
        ) : (
          <FormField label={t("vatRate")} htmlFor="vatRate">
            <Input
              id="vatRate"
              type="number"
              min={0}
              max={100}
              value={vatRatePercent}
              onChange={(e) => setVatRatePercent(e.target.value)}
            />
          </FormField>
        )}

        {service && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v: boolean) => setActive(v)} />
            {t("serviceActive")}
          </label>
        )}
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        <Button className="w-full" disabled={!canSubmit} onClick={handleSave}>
          {t("save")}
        </Button>
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}
