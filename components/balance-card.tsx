import { cn } from "cn";
import { formatALL } from "@/lib/format";

// frame 08/09's amber "Balance owed" card. Falls back to a neutral/green
// "Balance" card at zero (no mock shows this state explicitly, but every
// patient record needs SOME rendering when nothing is owed).
export function BalanceCard({
  balance,
  label,
  subtext,
  className,
}: {
  balance: number;
  label: string;
  /** Already-composed, e.g. t("ofOpenCharges", { amount, count }) -- this
   * component doesn't own translation interpolation. */
  subtext?: React.ReactNode;
  className?: string;
}) {
  const owed = balance > 0;
  return (
    <div
      data-slot="balance-card"
      className={cn(
        "rounded-[14px] border px-5 py-3.5",
        owed ? "border-status-noshow/25 bg-status-noshow-bg" : "border-status-done/20 bg-status-done-bg",
        className,
      )}
    >
      <div
        className={cn(
          "text-[12.5px] font-semibold",
          owed ? "text-status-noshow" : "text-status-done",
        )}
      >
        {label}
      </div>
      <div className={cn("text-[26px] font-bold tracking-tight tabular-nums", owed ? "text-status-noshow" : "text-status-done")}>
        {formatALL(balance)}
      </div>
      {owed && subtext && (
        <div className="mt-0.5 text-xs text-status-noshow/80">{subtext}</div>
      )}
    </div>
  );
}
