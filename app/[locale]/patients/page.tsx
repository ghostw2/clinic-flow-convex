"use client";

import * as React from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { useTranslations, useLocale } from "next-intl";
import { UserRoundPlus, Search as SearchIcon, MoreHorizontal, Upload, Download, SlidersHorizontal, Columns3 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chip, Segmented } from "@/components/chip";
import { DataTable, createDataTableColumnHelper, selectionColumn } from "@/components/data-table";
import type { RowSelectionState } from "@tanstack/react-table";
import { MoneyAmount } from "@/components/money-amount";
import { ServiceDot } from "@/components/service-dot";
import { NewPatientDrawer } from "@/components/patients/new-patient-drawer";
import { avatarTint, initials } from "@/lib/format";
import { ageFromDob, sexLetter, formatDate } from "@/lib/patient-format";
import { useMediaQuery } from "@/lib/use-media-query";

type Segment = "all" | "owesMoney" | "seenThisMonth" | "archived";
type Patient = Doc<"patients">;

const columnHelper = createDataTableColumnHelper<Patient>();

function PatientsListSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-[52px] items-center gap-4 border-b border-border px-4 last:border-0">
          <div className="size-6 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function PatientsMobileList({
  rows,
  onOpen,
}: {
  rows: Patient[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
      {rows.map((p) => {
        const name = `${p.firstName} ${p.lastName}`;
        return (
          <button
            key={p._id}
            type="button"
            onClick={() => onOpen(p._id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
          >
            <Avatar size="sm" className={avatarTint(p._id)}>
              <AvatarFallback className={avatarTint(p._id)}>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 grow">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {p.phone}
                {p.lastServiceName ? ` · ${p.lastServiceName}` : ""}
              </div>
            </div>
            <MoneyAmount amount={p.balance} tone={p.balance > 0 ? "negative" : "muted"} />
          </button>
        );
      })}
    </div>
  );
}

export default function PatientsListPage() {
  const t = useTranslations("Patients");
  const locale = useLocale();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [segment, setSegment] = React.useState<Segment>("all");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [newPatientOpen, setNewPatientOpen] = React.useState(false);
  const archivePatient = useMutation(api.patients.archivePatient);
  const unarchivePatient = useMutation(api.patients.unarchivePatient);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const counts = useQuery(api.patients.patientSegmentCounts);
  const searchResults = useQuery(
    api.patients.searchPatients,
    debouncedSearch ? { term: debouncedSearch } : "skip",
  );

  const { results, status, loadMore } = usePaginatedQuery(
    api.patients.listPatients,
    debouncedSearch
      ? "skip"
      : {
          archived: segment === "archived",
          segment: segment === "archived" ? undefined : (segment as "all" | "owesMoney" | "seenThisMonth"),
        },
    { initialNumItems: 20 },
  );

  const rows: Patient[] = debouncedSearch ? (searchResults ?? []) : results;
  const isLoading = debouncedSearch ? searchResults === undefined : status === "LoadingFirstPage";

  const columns = React.useMemo(
    () =>
      columnHelper.columns([
        selectionColumn<Patient>(),
        columnHelper.accessor("firstName", {
          id: "patient",
          header: t("columnPatient"),
          cell: ({ row }) => {
            const p = row.original;
            const name = `${p.firstName} ${p.lastName}`;
            return (
              <div className="flex items-center gap-2.5">
                <Avatar size="sm" className={avatarTint(p._id)}>
                  <AvatarFallback className={avatarTint(p._id)}>{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="font-semibold">{name}</span>
              </div>
            );
          },
        }),
        columnHelper.accessor("phone", {
          header: t("columnPhone"),
          cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.phone}</span>,
        }),
        columnHelper.display({
          id: "sexAge",
          header: t("columnSexAge"),
          cell: ({ row }) => {
            const age = ageFromDob(row.original.dob);
            return (
              <span className="text-muted-foreground">
                {sexLetter(row.original.gender)} · {age ?? "—"}
              </span>
            );
          },
        }),
        columnHelper.accessor("lastVisitAt", {
          header: t("columnLastVisit"),
          cell: ({ row }) => (
            <span className="tabular-nums">
              {row.original.lastVisitAt ? formatDate(row.original.lastVisitAt, locale) : "—"}
            </span>
          ),
        }),
        columnHelper.display({
          id: "lastService",
          header: t("columnLastService"),
          cell: ({ row }) =>
            row.original.lastServiceName ? (
              <div className="flex items-center gap-1.5">
                <ServiceDot colour={row.original.lastServiceColour ?? "#999"} />
                {row.original.lastServiceName}
              </div>
            ) : null,
        }),
        columnHelper.display({
          id: "flags",
          header: "",
          cell: ({ row }) => {
            const p = row.original;
            if ((p.noShowCount ?? 0) > 0) {
              return (
                <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-status-noshow-bg px-2 text-xs font-medium text-status-noshow">
                  {t("noShowBadge", { count: p.noShowCount ?? 0 })}
                </span>
              );
            }
            if (!p.lastVisitAt) {
              return (
                <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-status-booked-bg px-2 text-xs font-medium text-status-booked">
                  {t("newBadge")}
                </span>
              );
            }
            return null;
          },
        }),
        columnHelper.accessor("balance", {
          header: () => <div className="text-right">{t("columnBalance")}</div>,
          cell: ({ row }) => (
            <div className="text-right">
              <MoneyAmount
                amount={row.original.balance}
                tone={row.original.balance > 0 ? "negative" : "muted"}
              />
            </div>
          ),
        }),
        columnHelper.display({
          id: "menu",
          header: "",
          cell: ({ row }) => {
            const p = row.original;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {segment === "archived" ? (
                    <DropdownMenuItem onClick={() => unarchivePatient({ patientId: p._id })}>
                      {t("unarchive")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => archivePatient({ patientId: p._id })}>
                      {t("archive")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        }),
      ]),
    [t, locale, segment, archivePatient, unarchivePatient],
  );

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  return (
    <AppShell
      topbar={
        <>
          <h1 className="text-[18px] font-semibold tracking-tight">{t("title")}</h1>
          <div className="grow" />
          <div className="relative w-[300px]">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 bg-muted pl-9"
            />
          </div>
          <Button variant="outline" disabled title={t("comingSoon")}>
            <Upload /> {t("import")}
          </Button>
          <Button onClick={() => setNewPatientOpen(true)}>
            <UserRoundPlus /> {t("newPatient")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-4 pt-4 md:px-0 md:pt-0">
        <div className="flex items-center gap-2">
          <Segmented
            value={segment}
            onValueChange={setSegment}
            options={[
              { value: "all", label: `${t("segmentAll")} · ${counts?.all ?? "…"}` },
              { value: "owesMoney", label: `${t("segmentOwesMoney")} · ${counts?.owesMoney ?? "…"}` },
              { value: "seenThisMonth", label: t("segmentSeenThisMonth") },
              { value: "archived", label: t("segmentArchived") },
            ]}
          />
          <div className="grow" />
          <div className="hidden items-center gap-2 md:flex">
            <Chip disabled title={t("comingSoon")}>
              <SlidersHorizontal className="size-3.5" /> {t("filter")}
            </Chip>
            <Chip disabled title={t("comingSoon")}>
              <Columns3 className="size-3.5" /> {t("columns")}
            </Chip>
            <Chip disabled title={t("comingSoon")}>
              <Download className="size-3.5" /> {t("export")}
            </Chip>
          </div>
        </div>

        {isLoading ? (
          <PatientsListSkeleton />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-border py-16 text-center">
            <p className="font-semibold">{debouncedSearch ? t("noSearchResults") : t("noPatients")}</p>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch ? t("noSearchResultsHint") : t("noPatientsHint")}
            </p>
          </div>
        ) : isMobile ? (
          <div className="flex flex-col gap-3">
            <PatientsMobileList rows={rows} onOpen={(id) => router.push(`/patients/${id}`)} />
            {!debouncedSearch && status === "CanLoadMore" && (
              <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
                {t("loadMore")}
              </Button>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(p) => p._id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onRowClick={(p) => router.push(`/patients/${p._id}`)}
            footer={
              !debouncedSearch && (
                <div className="flex w-full items-center justify-between">
                  <span>
                    {selectedIds.length > 0
                      ? t("selectedCount", { count: selectedIds.length })
                      : " "}
                  </span>
                  {status === "CanLoadMore" && (
                    <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
                      {t("loadMore")}
                    </Button>
                  )}
                </div>
              )
            }
          />
        )}
      </div>

      <NewPatientDrawer open={newPatientOpen} onOpenChange={setNewPatientOpen} />
    </AppShell>
  );
}
