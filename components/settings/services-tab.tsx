"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ServiceDot } from "@/components/service-dot";
import { MoneyAmount } from "@/components/money-amount";
import { ServiceDrawer } from "@/components/settings/service-drawer";

// Spec Sec13: "Appointments -- services, durations, prices, colours,
// reminders." The onboarding wizard already tells the operator "Mund t'i
// ndryshoni ne cdo kohe te Cilesimet -> Sherbimet" ("change this anytime
// in Settings -> Services"), but until this tab existed that promise had
// no real destination -- the sidebar's /services link 404'd.
export function ServicesTab() {
  const t = useTranslations("Settings");
  const services = useQuery(api.services.listServices, {});
  const [editingId, setEditingId] = React.useState<Id<"services"> | "new" | null>(null);

  if (!services) {
    return <div className="h-40 animate-pulse rounded-[14px] bg-muted" />;
  }

  const editingService =
    editingId && editingId !== "new" ? (services.find((s) => s._id === editingId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditingId("new")}>
          <Plus className="size-3.5" /> {t("newService")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        {services.length === 0 ? (
          <p className="p-[18px] text-sm text-muted-foreground">{t("noServices")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {services.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => setEditingId(s._id)}
                  className="flex w-full items-center gap-3 px-[18px] py-3 text-left hover:bg-muted/40"
                >
                  <ServiceDot colour={s.colour} className="size-3" />
                  <div className="grow">
                    <div className={`text-sm font-semibold ${!s.active ? "text-muted-foreground line-through" : ""}`}>
                      {s.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.durationMin} min{s.vatRate > 0 ? ` · VAT ${(s.vatRate * 100).toFixed(0)}%` : ""}
                    </div>
                  </div>
                  <MoneyAmount amount={s.price} className="text-sm" />
                  {!s.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("inactive")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingId === "new" && <ServiceDrawer service={null} onClose={() => setEditingId(null)} />}
      {editingService && <ServiceDrawer service={editingService} onClose={() => setEditingId(null)} />}
    </div>
  );
}
