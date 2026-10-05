"use client";

import * as React from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { Activity, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Chip, Kbd, Segmented } from "@/components/chip";
import { DataTable, createDataTableColumnHelper, selectionColumn } from "@/components/data-table";
import { EntityDrawer } from "@/components/entity-drawer";
import { FormField } from "@/components/form-field";
import { MoneyAmount } from "@/components/money-amount";
import { AppointmentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { ServiceDot } from "@/components/service-dot";
import { avatarTint, initials } from "@/lib/format";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_COLOURS,
  serviceColourVar,
} from "@/lib/status";

/** frame 15 "Brand & neutrals" swatch strip. */
const NEUTRAL_SWATCHES: { name: string; className: string; hex: string }[] = [
  { name: "brand-950", className: "bg-brand-950", hex: "#0E231F" },
  { name: "sidebar", className: "bg-sidebar", hex: "#14302A" },
  { name: "primary", className: "bg-primary", hex: "#1E6B4E" },
  { name: "ring", className: "bg-ring", hex: "#3FA66B" },
  { name: "brand-300", className: "bg-brand-300", hex: "#98D78A" },
  { name: "brand-100", className: "bg-brand-100", hex: "#DDF2D5" },
  { name: "brand-50", className: "bg-brand-50", hex: "#EEF8EA" },
  { name: "foreground", className: "bg-foreground", hex: "#13221D" },
  { name: "muted-fg", className: "bg-muted-foreground", hex: "#66746E" },
  { name: "border", className: "bg-border", hex: "#E2E8E2" },
  { name: "muted", className: "bg-muted", hex: "#EFF3EE" },
  { name: "background", className: "bg-background", hex: "#F6F8F5" },
];

const SERVICE_LABEL: Record<(typeof SERVICE_COLOURS)[number], string> = {
  consult: "Konsultë",
  clean: "Pastrim",
  fill: "Mbushje",
  extract: "Nxjerrje",
  white: "Zbardhim",
  check: "Kontroll",
  canal: "Kanal",
};

type PatientRow = { id: string; name: string; lastVisit: string; balance: number };

const PATIENT_ROWS: PatientRow[] = [
  { id: "p1", name: "Arta Hoxha", lastVisit: "28 Sep", balance: 0 },
  { id: "p2", name: "Arben Çela", lastVisit: "21 Sep", balance: 12200 },
  { id: "p3", name: "Donika Rama", lastVisit: "18 Aug", balance: 18500 },
];

const patientColumnHelper = createDataTableColumnHelper<PatientRow>();

// `.columns([...])` (rather than a plain array literal) preserves each
// column's own TValue instead of widening the whole array to the first
// element's type -- see @tanstack/react-table's columnHelper docs.
const patientColumns = patientColumnHelper.columns([
  selectionColumn<PatientRow>(),
  patientColumnHelper.accessor("name", {
    header: "Patient",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Avatar size="sm" className={avatarTint(row.original.id)}>
          <AvatarFallback className={avatarTint(row.original.id)}>
            {initials(row.original.name)}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold">{row.original.name}</span>
      </div>
    ),
  }),
  patientColumnHelper.accessor("lastVisit", {
    header: "Last visit",
    cell: ({ row }) => <span className="tabular-nums">{row.original.lastVisit}</span>,
  }),
  patientColumnHelper.accessor("balance", {
    header: () => <div className="text-right">Balance</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <MoneyAmount
          amount={row.original.balance}
          tone={row.original.balance === 0 ? "muted" : "negative"}
        />
      </div>
    ),
  }),
]);

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-foreground uppercase">
        {children}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

function Swatch({ name, className, hex }: { name: string; className: string; hex: string }) {
  return (
    <div className="flex w-24 flex-col gap-1.5">
      <div className={`h-16 rounded-xl border border-black/5 ${className}`} />
      <div className="text-xs font-semibold">{name}</div>
      <div className="font-mono text-xs text-muted-foreground">{hex}</div>
    </div>
  );
}

export default function DevKitPage() {
  const [day, setDay] = React.useState<"day" | "week">("day");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({ p2: true });

  return (
    <div className="mx-auto max-w-[1440px] px-16 py-14">
      <div className="mb-9 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-900 text-brand-300">
          <Activity className="size-5" strokeWidth={2.4} />
        </div>
        <div>
          <div className="text-[30px] font-bold tracking-tight">ClinicFlow UI kit</div>
          <div className="text-muted-foreground">
            Tokens map 1:1 to shadcn/ui CSS variables · Inter · Lucide icons · 4px grid
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10">
        {/* Brand & neutrals */}
        <div className="flex flex-col gap-4">
          <SectionLabel>Brand &amp; neutrals</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {NEUTRAL_SWATCHES.map((swatch) => (
              <Swatch key={swatch.name} {...swatch} />
            ))}
          </div>
        </div>

        {/* Status / service colours / type scale */}
        <div className="flex flex-wrap items-start gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>Appointment status</SectionLabel>
            <div className="flex flex-col gap-2.5">
              {APPOINTMENT_STATUSES.filter((s) => s !== "confirmed").map((status) => (
                <div key={status} className="flex items-center gap-4">
                  <AppointmentStatusBadge status={status} />
                  <span className="font-mono text-xs text-muted-foreground">--s-{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel>Payment status</SectionLabel>
            <div className="flex flex-col gap-2.5">
              {PAYMENT_STATUSES.map((status) => (
                <PaymentStatusBadge key={status} status={status} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel>Service colours (calendar)</SectionLabel>
            <div className="flex flex-col gap-2.5">
              {SERVICE_COLOURS.map((colour) => (
                <div key={colour} className="flex items-center gap-2.5">
                  <div
                    className="relative flex h-[34px] w-[180px] items-center overflow-hidden rounded-lg pl-3"
                    style={{ backgroundColor: `color-mix(in srgb, var(${serviceColourVar[colour]}) 13%, white)` }}
                  >
                    <ServiceDot
                      colour={`var(${serviceColourVar[colour]})`}
                      className="absolute inset-y-0 left-0 h-full w-1 rounded-none"
                    />
                    <span className="text-[12.5px] font-semibold">{SERVICE_LABEL[colour]}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">--svc-{colour}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel>Type scale</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="text-[30px] font-bold tracking-tight">Display 30/700</div>
              <div className="text-[22px] font-bold tracking-tight">Title 22/700</div>
              <div className="text-lg font-semibold">Page heading 18/650</div>
              <div className="text-[14.5px] font-semibold">Card heading 14.5/650</div>
              <div className="text-sm">Body 14/400 — Mirë se vini</div>
              <div className="text-[12.5px] text-muted-foreground">Caption 12.5/400</div>
              <div className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Overline 11/600 caps
              </div>
              <div className="text-2xl font-bold tracking-tight tabular-nums">
                ALL 12,200 <span className="text-xs font-medium text-muted-foreground">tabular nums</span>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons / FormField / DataTable */}
        <div className="flex flex-wrap items-start gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>Buttons</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2.5">
                <Button>
                  <Plus /> Primary
                </Button>
                <Button variant="outline">Secondary</Button>
                <Button className="border-brand-200 bg-brand-100 text-brand-900 hover:bg-brand-200">
                  Mint
                </Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">
                  <Trash2 /> Danger
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button size="sm">Small 30</Button>
                <Button>Default 36</Button>
                <Button size="lg">Large 46</Button>
                <Button className="h-14 rounded-xl px-5.5 text-base">Touch 56</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="outline" size="icon">
                  <ChevronDown />
                </Button>
                <Chip>Chip</Chip>
                <Chip active>Chip on</Chip>
                <Segmented
                  value={day}
                  onValueChange={setDay}
                  options={[
                    { value: "day", label: "Day" },
                    { value: "week", label: "Week" },
                  ]}
                />
                <Kbd>⌘K</Kbd>
              </div>
            </div>
          </div>

          <div className="flex w-[340px] flex-col gap-4">
            <SectionLabel>FormField</SectionLabel>
            <div className="flex flex-col gap-3.5">
              <FormField label="Patient name" required>
                <Input defaultValue="Arta Hoxha" />
              </FormField>
              <FormField label="Phone" hint="Used to detect duplicates">
                <Input defaultValue="+355 69 412 33" />
              </FormField>
              <FormField
                label="NID"
                error={
                  <>
                    Matches existing patient Arben Çela —{" "}
                    <button type="button" className="font-bold underline">
                      open record
                    </button>
                  </>
                }
              >
                <Input defaultValue="J50312045K" aria-invalid />
              </FormField>
              <FormField label="Service">
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 text-[13.5px]"
                >
                  <ServiceDot colour={`var(${serviceColourVar.fill})`} />
                  <span className="grow text-left">Mbushje kompozit</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </FormField>
            </div>
          </div>

          <div className="flex w-[400px] flex-col gap-4">
            <SectionLabel>DataTable</SectionLabel>
            <DataTable
              columns={patientColumns}
              data={PATIENT_ROWS}
              getRowId={(row) => row.id}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              footer={
                <div className="flex w-full items-center justify-between">
                  <span>Row 52 · header 11.5 caps · selected = brand-50</span>
                  <span>1–3 of 412</span>
                </div>
              }
            />
          </div>
        </div>

        {/* EntityDrawer anatomy / Spacing, radius, elevation */}
        <div className="flex flex-wrap items-start gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>EntityDrawer anatomy</SectionLabel>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex h-[360px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
                  <Avatar size="sm" className={avatarTint("AH")}>
                    <AvatarFallback className={avatarTint("AH")}>AH</AvatarFallback>
                  </Avatar>
                  <div className="grow">
                    <div className="text-sm font-bold">Header · entity + balance</div>
                    <div className="text-xs text-muted-foreground">context line</div>
                  </div>
                  <X className="size-3.5" />
                </div>
                <div className="flex gap-1.5 border-b border-border px-4 py-2.5">
                  <div className="h-1 flex-1 rounded-full bg-brand-500" />
                  <div className="h-1 flex-1 rounded-full bg-brand-500" />
                  <div className="h-1 flex-1 rounded-full bg-brand-500" />
                  <div className="h-1 flex-1 rounded-full bg-muted" />
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <div className="h-10 rounded-lg bg-muted" />
                  <div className="h-20 rounded-lg bg-muted" />
                  <div className="text-xs text-muted-foreground">Body · FormFields, scrolls</div>
                </div>
                <div className="border-t border-border bg-[#FBFCFB] p-3">
                  <Button className="h-12 w-full">Primary action · 56 on tablet</Button>
                </div>
              </div>
              <div className="flex w-[300px] flex-col gap-2.5 text-sm text-muted-foreground">
                <div>
                  <b className="text-foreground">Docked</b> (calendar, ≥1280px): 404px, calendar
                  stays visible.
                </div>
                <div>
                  <b className="text-foreground">Overlay</b> (&lt;1280px): slides over with scrim.
                </div>
                <div>
                  <b className="text-foreground">Sheet</b> (mobile): bottom sheet, same content.
                </div>
                <div>
                  <b className="text-foreground">States</b> are steps in one drawer (detail →
                  charge → receipt), never a new page.
                </div>
                <Button variant="outline" size="sm" className="mt-1 w-fit" onClick={() => setDrawerOpen(true)}>
                  Preview live component
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel>Spacing, radius, elevation</SectionLabel>
            <div className="flex flex-col gap-4">
              <div className="flex items-end gap-3">
                {[4, 8, 12, 16, 20, 24, 32].map((size) => (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <div
                      className="rounded-sm bg-brand-300"
                      style={{ width: size, height: size }}
                    />
                    <span className="text-xs text-muted-foreground">{size}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                {[
                  { label: "sm 7", className: "rounded-[7px]" },
                  { label: "md 10", className: "rounded-[10px]" },
                  { label: "lg 14", className: "rounded-[14px]" },
                  { label: "sheet 24", className: "rounded-sheet" },
                ].map((r) => (
                  <div key={r.label} className="flex flex-col items-center gap-1.5">
                    <div className={`h-12 w-16 border-[1.5px] border-brand-500 ${r.className}`} />
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                {[
                  { label: "shadow-sm", className: "shadow-card-sm" },
                  { label: "shadow", className: "shadow-card" },
                  { label: "shadow-lg", className: "shadow-card-lg" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center gap-1.5">
                    <div className={`h-14 w-21 rounded-xl border border-border bg-card ${s.className}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <EntityDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <EntityDrawer.Header
          avatar={
            <Avatar size="sm" className={avatarTint("AH")}>
              <AvatarFallback className={avatarTint("AH")}>AH</AvatarFallback>
            </Avatar>
          }
          title="Arta Hoxha"
          subtitle="Live EntityDrawer preview"
          onClose={() => setDrawerOpen(false)}
        />
        <EntityDrawer.Steps count={3} current={0} />
        <EntityDrawer.Body>
          <p className="text-sm text-muted-foreground">
            Resize the window: right-side overlay with a scrim below 1280px, no scrim (docked
            look) at 1280px and above, bottom sheet under 768px.
          </p>
        </EntityDrawer.Body>
        <EntityDrawer.Footer>
          <Button className="w-full">Primary action</Button>
        </EntityDrawer.Footer>
      </EntityDrawer>
    </div>
  );
}
