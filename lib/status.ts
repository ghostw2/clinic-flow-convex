import {
  CalendarCheck2,
  DoorOpen,
  Loader2,
  CircleCheck,
  UserX,
  CircleX,
  CircleDashed,
  CircleAlert,
  CalendarDays,
  PenLine,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for status -> colour/icon/label, per
// design/IMPLEMENTATION_BRIEF.md: "Status -> colour mapping lives in ONE
// place (lib/status.ts), used by badges and the calendar." Token names match
// app/globals.css's --status-* custom properties (design/tokens.json).

export const APPOINTMENT_STATUSES = [
  "booked",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// "Payment status" (frame 15) is a display concept derived from a patient's
// charges/payments, not a raw Convex field -- see billing screens (step 3+).
export const PAYMENT_STATUSES = ["paid", "partial", "unpaid", "plan", "draft"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Icon + colour only -- text labels live in messages/{en,sq}.json under the
// "Status" namespace (status-badge.tsx looks them up by status key) so
// AppointmentStatusBadge/PaymentStatusBadge render in the active locale
// instead of the English strings this used to hardcode.
type StatusVisual = {
  icon: LucideIcon;
  /** Tailwind classes referencing the --status-* tokens in app/globals.css. */
  className: string;
};

export const appointmentStatusVisual: Record<AppointmentStatus, StatusVisual> = {
  booked: {
    icon: CalendarCheck2,
    className: "bg-status-booked-bg text-status-booked",
  },
  // The design doesn't draw a distinct "confirmed" chip; treat it as booked
  // until a frame says otherwise.
  confirmed: {
    icon: CalendarCheck2,
    className: "bg-status-booked-bg text-status-booked",
  },
  arrived: {
    icon: DoorOpen,
    className: "bg-status-arrived-bg text-status-arrived",
  },
  in_progress: {
    icon: Loader2,
    className: "bg-status-progress-bg text-status-progress",
  },
  completed: {
    icon: CircleCheck,
    className: "bg-status-done-bg text-status-done",
  },
  no_show: {
    icon: UserX,
    className: "bg-status-noshow-bg text-status-noshow",
  },
  cancelled: {
    icon: CircleX,
    className: "bg-status-cancel-bg text-status-cancel",
  },
};

export const paymentStatusVisual: Record<PaymentStatus, StatusVisual> = {
  paid: {
    icon: CircleCheck,
    className: "bg-status-done-bg text-status-done",
  },
  partial: {
    icon: CircleDashed,
    className: "bg-status-noshow-bg text-status-noshow",
  },
  unpaid: {
    icon: CircleAlert,
    className: "bg-status-cancel-bg text-status-cancel",
  },
  plan: {
    icon: CalendarDays,
    className: "bg-status-progress-bg text-status-progress",
  },
  draft: {
    icon: PenLine,
    className: "bg-status-neutral-bg text-status-neutral",
  },
};

// Service colours (calendar), keyed the same way convex/schema.ts's
// `services.colour` field is expected to store them.
export const SERVICE_COLOURS = [
  "consult",
  "clean",
  "fill",
  "extract",
  "white",
  "check",
  "canal",
] as const;

export type ServiceColour = (typeof SERVICE_COLOURS)[number];

export const serviceColourVar: Record<ServiceColour, string> = {
  consult: "--color-svc-consult",
  clean: "--color-svc-clean",
  fill: "--color-svc-fill",
  extract: "--color-svc-extract",
  white: "--color-svc-white",
  check: "--color-svc-check",
  canal: "--color-svc-canal",
};
