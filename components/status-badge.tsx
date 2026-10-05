import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  appointmentStatusVisual,
  paymentStatusVisual,
  type AppointmentStatus,
  type PaymentStatus,
} from "@/lib/status";

type BaseProps = {
  className?: string;
};

function BadgeShell({
  icon: Icon,
  visualClassName,
  label,
  className,
}: BaseProps & { icon: LucideIcon; visualClassName: string; label: string }) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-full py-0 pr-[9px] pl-[7px] text-xs font-medium whitespace-nowrap [&>svg]:size-[13px]",
        visualClassName,
        className,
      )}
    >
      <Icon aria-hidden />
      {label}
    </span>
  );
}

export function AppointmentStatusBadge({
  status,
  className,
}: BaseProps & { status: AppointmentStatus }) {
  const t = useTranslations("Status");
  const visual = appointmentStatusVisual[status];
  return (
    <BadgeShell
      icon={visual.icon}
      visualClassName={visual.className}
      label={t(`appointment.${status}`)}
      className={className}
    />
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: BaseProps & { status: PaymentStatus }) {
  const t = useTranslations("Status");
  const visual = paymentStatusVisual[status];
  return (
    <BadgeShell
      icon={visual.icon}
      visualClassName={visual.className}
      label={t(`payment.${status}`)}
      className={className}
    />
  );
}
