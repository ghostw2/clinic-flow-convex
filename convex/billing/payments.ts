import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireOwner, requireUser } from "../lib/auth_helpers";
import { writeAudit } from "../lib/audit";
import { recomputeBalance } from "./balance";
import { syncInstallmentStatuses } from "./installmentSync";
import { PAYMENT_METHOD } from "../schema";

// Spec Sec7.4: "Auto-allocation FIFO against open charges by default."
// A plain function so it can be shared by recordPayment and
// payInFullCash and run inside their transaction.
export async function allocateFifo(
  ctx: MutationCtx,
  patientId: Id<"patients">,
  amount: number,
): Promise<Array<{ chargeId: Id<"charges">; amount: number }>> {
  const openCharges = await ctx.db
    .query("charges")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .order("asc")
    .filter((q) => q.eq(q.field("voidedAt"), undefined))
    .collect();

  const existingPayments = await ctx.db
    .query("payments")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .collect();
  const allocatedByCharge = new Map<string, number>();
  for (const payment of existingPayments) {
    for (const allocation of payment.allocations ?? []) {
      allocatedByCharge.set(
        allocation.chargeId,
        (allocatedByCharge.get(allocation.chargeId) ?? 0) + allocation.amount,
      );
    }
  }

  let remaining = amount;
  const allocations: Array<{ chargeId: Id<"charges">; amount: number }> = [];
  for (const charge of openCharges) {
    if (remaining <= 0) break;
    const alreadyAllocated = allocatedByCharge.get(charge._id) ?? 0;
    const open = charge.amount - alreadyAllocated;
    if (open <= 0) continue;
    const toAllocate = Math.min(open, remaining);
    allocations.push({ chargeId: charge._id, amount: toAllocate });
    remaining -= toAllocate;
  }
  // Any remaining, unallocated amount becomes account credit implicitly:
  // it's simply not attached to a charge, so `balance = charges - payments`
  // (billing/balance.ts) goes negative, exactly matching spec Sec7.4's
  // "overpayment becomes account credit, applied to the next charge
  // automatically" -- no separate credit table needed.
  return allocations;
}

export const recordPayment = mutation({
  args: {
    patientId: v.id("patients"),
    amount: v.number(),
    method: PAYMENT_METHOD,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const allocations = await allocateFifo(ctx, args.patientId, args.amount);
    const paymentId = await ctx.db.insert("payments", {
      patientId: args.patientId,
      amount: args.amount,
      method: args.method,
      receivedAt: Date.now(),
      receivedBy: user._id,
      note: args.note,
      allocations,
    });
    await recomputeBalance(ctx, args.patientId);
    await syncInstallmentStatuses(ctx, args.patientId);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "payment.record",
      entity: "payments",
      entityId: paymentId,
      after: args,
    });
    return paymentId;
  },
});

// Spec Sec14: "One-click 'Paid in full, cash.' Overwhelmingly the common
// case -- a button, not a form."
export const payInFullCash = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const patient = await ctx.db.get(args.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }
    if (patient.balance <= 0) {
      throw new ConvexError("Patient has no outstanding balance");
    }
    const allocations = await allocateFifo(ctx, args.patientId, patient.balance);
    const paymentId = await ctx.db.insert("payments", {
      patientId: args.patientId,
      amount: patient.balance,
      method: "cash",
      receivedAt: Date.now(),
      receivedBy: user._id,
      allocations,
    });
    await recomputeBalance(ctx, args.patientId);
    await syncInstallmentStatuses(ctx, args.patientId);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "payment.payInFullCash",
      entity: "payments",
      entityId: paymentId,
      after: { amount: patient.balance },
    });
    return paymentId;
  },
});

// Spec Sec7.4: "Refunds as negative payments linked to the original."
export const refundPayment = mutation({
  args: {
    paymentId: v.id("payments"),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const original = await ctx.db.get(args.paymentId);
    if (original === null) {
      throw new ConvexError("Payment not found");
    }
    const refundAmount = -Math.abs(args.amount);
    const refundId = await ctx.db.insert("payments", {
      patientId: original.patientId,
      amount: refundAmount,
      method: original.method,
      receivedAt: Date.now(),
      receivedBy: user._id,
      note: args.note,
      refundOfId: args.paymentId,
    });
    await recomputeBalance(ctx, original.patientId);
    await syncInstallmentStatuses(ctx, original.patientId);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "payment.refund",
      entity: "payments",
      entityId: refundId,
      after: { originalPaymentId: args.paymentId, amount: refundAmount },
    });
    return refundId;
  },
});

export const listPaymentsForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("payments")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

// Feeds the future Finances "Today" tab (spec Sec10).
export const listPaymentsToday = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return await ctx.db
      .query("payments")
      .withIndex("by_received", (q) => q.gte("receivedAt", startOfDay.getTime()))
      .collect();
  },
});

// Step 5's Finances "Today's payments" table: same as listPaymentsToday, but
// joined to the patient's name server-side -- `payments` doesn't denormalize
// it (unlike appointments/charges), and this avoids an N-query fan-out or a
// large unbounded patients fetch on the client just to build a lookup map.
export const listPaymentsTodayWithNames = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_received", (q) => q.gte("receivedAt", startOfDay.getTime()))
      .order("desc")
      .collect();
    const patientIds = [...new Set(payments.map((p) => p.patientId))];
    const patients = await Promise.all(patientIds.map((id) => ctx.db.get(id)));
    const nameById = new Map(
      patients.filter((p) => p !== null).map((p) => [p._id, `${p.firstName} ${p.lastName}`]),
    );
    return payments.map((p) => ({ ...p, patientName: nameById.get(p.patientId) ?? "—" }));
  },
});
