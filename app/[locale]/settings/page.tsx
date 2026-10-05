"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Segmented } from "@/components/chip";
import { avatarTint, initials } from "@/lib/format";
import { ServicesTab } from "@/components/settings/services-tab";
import { ClinicTab } from "@/components/settings/clinic-tab";
import { DataTab } from "@/components/settings/data-tab";
import { ClinicalTab } from "@/components/settings/clinical-tab";

type Tab = "clinic" | "appointments" | "patients" | "finances" | "communication" | "team" | "clinical" | "data";

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "team";

  const tabs: Tab[] = [
    "clinic",
    "appointments",
    "patients",
    "finances",
    "communication",
    "team",
    "clinical",
    "data",
  ];

  return (
    <AppShell topbar={<h1 className="text-[18px] font-semibold tracking-tight">{t("title")}</h1>}>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 overflow-x-auto border-b border-border">
          {tabs.map((tabItem) => (
            <Link
              key={tabItem}
              href={`/settings?tab=${tabItem}`}
              className={`shrink-0 border-b-2 pb-2.5 text-[13.5px] font-semibold whitespace-nowrap ${
                tab === tabItem ? "border-brand-700 text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {t(`tab.${tabItem}`)}
            </Link>
          ))}
        </div>

        {tab === "clinic" ? (
          <ClinicTab />
        ) : tab === "team" ? (
          <TeamTab />
        ) : tab === "appointments" ? (
          <ServicesTab />
        ) : tab === "data" ? (
          <DataTab />
        ) : tab === "clinical" ? (
          <ClinicalTab />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-border py-16 text-center">
            <p className="font-semibold">{t("comingSoonTab")}</p>
            <p className="text-sm text-muted-foreground">{t("comingSoonTabHint")}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TeamTab() {
  const t = useTranslations("Settings");
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.listUsers);
  const [editingUserId, setEditingUserId] = React.useState<Id<"users"> | null>(null);

  if (!users) {
    return <div className="h-40 animate-pulse rounded-[14px] bg-muted" />;
  }

  const isOwner = me?.role === "owner";
  const sorted = [...users].sort((a, b) => {
    if (a.role === undefined && b.role !== undefined) return 1;
    if (a.role !== undefined && b.role === undefined) return -1;
    return 0;
  });

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      <ul className="divide-y divide-border">
        {sorted.map((user) => (
          <li key={user._id} className="flex flex-col gap-3 px-[18px] py-3.5">
            <div className="flex items-center gap-3">
              <Avatar className={avatarTint(user._id)}>
                <AvatarFallback className={avatarTint(user._id)}>
                  {user.name ? initials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 grow">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{user.name || user.email}</span>
                  {me?._id === user._id && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {t("you")}
                    </span>
                  )}
                </div>
                {user.name && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <RoleBadge role={user.role} t={t} />
                {user.isPractitioner && (
                  <span className="rounded-full bg-status-progress-bg px-2 py-0.5 text-[11px] font-semibold text-status-progress">
                    {t("practitionerBadge")}
                  </span>
                )}
              </div>
              {isOwner && editingUserId !== user._id && (
                <Button variant="outline" size="sm" onClick={() => setEditingUserId(user._id)}>
                  {user.role === undefined ? t("assignRole") : t("editRole")}
                </Button>
              )}
            </div>
            {user.role === undefined && editingUserId !== user._id && (
              <p className="pl-[52px] text-xs text-status-noshow">{t("needsRole")}</p>
            )}
            {editingUserId === user._id && (
              <RoleEditForm user={user} onDone={() => setEditingUserId(null)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleBadge({
  role,
  t,
}: {
  role: "owner" | "assistant" | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  if (role === "owner") {
    return (
      <span className="rounded-full bg-status-done-bg px-2 py-0.5 text-[11px] font-semibold text-status-done">
        {t("roleOwner")}
      </span>
    );
  }
  if (role === "assistant") {
    return (
      <span className="rounded-full bg-status-booked-bg px-2 py-0.5 text-[11px] font-semibold text-status-booked">
        {t("roleAssistant")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-status-cancel-bg px-2 py-0.5 text-[11px] font-semibold text-status-cancel">
      {t("roleNone")}
    </span>
  );
}

function RoleEditForm({ user, onDone }: { user: Doc<"users">; onDone: () => void }) {
  const t = useTranslations("Settings");
  const [role, setRole] = React.useState<"owner" | "assistant">(user.role ?? "assistant");
  const [isPractitioner, setIsPractitioner] = React.useState(user.isPractitioner ?? false);
  const [submitting, setSubmitting] = React.useState(false);
  const setRoleMutation = useMutation(api.users.setRole);

  async function handleSave() {
    setSubmitting(true);
    try {
      await setRoleMutation({ userId: user._id, role, isPractitioner });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ml-[52px] flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("role")}</div>
        <Segmented
          value={role}
          onValueChange={setRole}
          options={[
            { value: "assistant", label: t("roleAssistant") },
            { value: "owner", label: t("roleOwner") },
          ]}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isPractitioner} onCheckedChange={(v: boolean) => setIsPractitioner(v)} />
        {t("isPractitioner")}
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={submitting} onClick={handleSave}>
          <Check className="size-3.5" /> {t("save")}
        </Button>
        <Button variant="outline" size="sm" disabled={submitting} onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
