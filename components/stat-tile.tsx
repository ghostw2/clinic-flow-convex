import { cn } from "cn";

export function StatTile({
  label,
  value,
  description,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="stat-tile"
      className={cn("rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-card-sm", className)}
    >
      <div className="text-[12.5px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[26px] font-bold tracking-tight tabular-nums">{value}</div>
      {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}
