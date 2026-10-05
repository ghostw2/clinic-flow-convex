import { cn } from "cn";
import { formatALL } from "@/lib/format";

type Tone = "default" | "positive" | "negative" | "muted";

const toneClass: Record<Tone, string> = {
  default: "",
  positive: "text-status-done",
  negative: "text-status-cancel",
  muted: "text-muted-foreground",
};

export function MoneyAmount({
  amount,
  tone = "default",
  className,
}: {
  amount: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      data-slot="money-amount"
      className={cn("font-semibold tabular-nums", toneClass[tone], className)}
    >
      {formatALL(amount)}
    </span>
  );
}
