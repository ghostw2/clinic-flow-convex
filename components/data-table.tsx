"use client";

import * as React from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TanStack Table v9 registers row models/behaviour as explicit "features"
// (see design/IMPLEMENTATION_BRIEF.md: "DataTable (TanStack Table + shadcn
// Table)"). One shared feature set for every ClinicFlow table -- sorting +
// row selection are all Phase-1 screens need (patients list, billing ledger).
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowSelectionFeature,
});

type Features = typeof dataTableFeatures;

export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<Features, TData>();
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  footer,
  className,
}: {
  columns: ColumnDef<Features, TData, unknown>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onRowClick?: (row: TData) => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    state: { rowSelection: rowSelection ?? {} },
    onRowSelectionChange,
    enableRowSelection: !!onRowSelectionChange,
  });

  return (
    <div
      data-slot="data-table"
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-card shadow-card-sm",
        className,
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-auto py-2.5 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              onClick={() => onRowClick?.(row.original)}
              className={cn(
                "data-[state=selected]:bg-brand-50",
                onRowClick && "cursor-pointer",
              )}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className="h-[52px] text-[13.5px]">
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {footer && (
        <div className="flex items-center justify-between border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Shared selection column: header "select all" + per-row checkbox. */
export function selectionColumn<TData extends RowData>(): ColumnDef<Features, TData, unknown> {
  const helper = createDataTableColumnHelper<TData>();
  return helper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(value)}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean) => row.toggleSelected(value)}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        aria-label="Select row"
      />
    ),
  });
}
