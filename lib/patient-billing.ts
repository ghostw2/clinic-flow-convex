import type { Doc, Id } from "@/convex/_generated/dataModel";

type Charge = Doc<"charges">;
type Payment = Doc<"payments">;
type Appointment = Doc<"appointments">;

/**
 * Per-charge "how much of this has been paid" -- reads the allocations the
 * backend already decided (billing/payments.ts's allocateFifo), never
 * re-derives WHERE a payment's money goes. Used for the "open charge"
 * progress card and the "Recent visits" Paid column.
 */
export function allocatedByCharge(payments: Payment[]): Map<Id<"charges">, number> {
  const map = new Map<Id<"charges">, number>();
  for (const payment of payments) {
    for (const allocation of payment.allocations ?? []) {
      map.set(allocation.chargeId, (map.get(allocation.chargeId) ?? 0) + allocation.amount);
    }
  }
  return map;
}

export type OpenCharge = { charge: Charge; paid: number; remaining: number };

/** Non-voided charges with `remaining > 0`, oldest first (FIFO order). */
export function openCharges(charges: Charge[], payments: Payment[]): OpenCharge[] {
  const allocated = allocatedByCharge(payments);
  return charges
    .filter((c) => c.voidedAt === undefined)
    .map((charge) => {
      const paid = allocated.get(charge._id) ?? 0;
      return { charge, paid, remaining: charge.amount - paid };
    })
    .filter((c) => c.remaining > 0)
    .sort((a, b) => a.charge.occurredAt - b.charge.occurredAt);
}

export function totalCharged(charges: Charge[]): number {
  return charges.filter((c) => c.voidedAt === undefined).reduce((sum, c) => sum + c.amount, 0);
}

export function totalPaid(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

export type LedgerRow =
  | { kind: "upcoming"; appointment: Appointment; date: number }
  | { kind: "charge"; charge: Charge; date: number; runningBalance: number }
  | { kind: "payment"; payment: Payment; date: number; runningBalance: number };

/**
 * Merges charges + payments into one newest-first ledger with a running
 * balance computed top-down from the chronological order (oldest first),
 * then reversed for display -- per the requirement, this is computed here,
 * never stored. An optional upcoming appointment renders as a preview row
 * with no running balance (nothing charged yet).
 */
export function buildLedger(
  charges: Charge[],
  payments: Payment[],
  upcomingAppointment?: Appointment,
): LedgerRow[] {
  type Entry =
    | { type: "charge"; date: number; delta: number; charge: Charge }
    | { type: "payment"; date: number; delta: number; payment: Payment };
  const entries: Entry[] = [
    ...charges
      .filter((c) => c.voidedAt === undefined)
      .map((charge): Entry => ({
        type: "charge",
        date: charge.occurredAt,
        delta: charge.amount,
        charge,
      })),
    ...payments.map((payment): Entry => ({
      type: "payment",
      date: payment.receivedAt,
      delta: -payment.amount,
      payment,
    })),
  ].sort((a, b) => a.date - b.date);

  let running = 0;
  const chronological: LedgerRow[] = entries.map((entry): LedgerRow => {
    running += entry.delta;
    return entry.type === "charge"
      ? { kind: "charge", charge: entry.charge, date: entry.date, runningBalance: running }
      : { kind: "payment", payment: entry.payment, date: entry.date, runningBalance: running };
  });
  const newestFirst = chronological.reverse();

  return upcomingAppointment
    ? [
        { kind: "upcoming", appointment: upcomingAppointment, date: upcomingAppointment.start },
        ...newestFirst,
      ]
    : newestFirst;
}

export type VisitRow = {
  date: number;
  charge: Charge;
  appointment: Appointment | undefined;
  paid: number;
};

/** "Recent visits" (frame 08): charges sourced from an appointment, joined
 * back to that appointment for practitioner/status. */
export function recentVisits(charges: Charge[], payments: Payment[], appointments: Appointment[]): VisitRow[] {
  const allocated = allocatedByCharge(payments);
  const byId = new Map(appointments.map((a) => [a._id as string, a]));
  return charges
    .filter((c) => c.source === "appointment" && c.voidedAt === undefined)
    .map((charge) => ({
      date: charge.occurredAt,
      charge,
      appointment: charge.sourceId ? byId.get(charge.sourceId) : undefined,
      paid: allocated.get(charge._id) ?? 0,
    }))
    .sort((a, b) => b.date - a.date);
}
