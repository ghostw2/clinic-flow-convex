import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireUser } from "../lib/auth_helpers";
import { writeAudit } from "../lib/audit";
import { allocateFifo } from "./payments";
import { recomputeBalance } from "./balance";
import { PAYMENT_METHOD } from "../schema";

const FREQUENCY = v.union(v.literal("monthly"), v.literal("biweekly"), v.literal("custom"));

function addInterval(
  startDate: number,
  frequency: "monthly" | "biweekly" | "custom",
  seq: number,
  customIntervalDays?: number,
): number {
  if (frequency === "monthly") {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + seq);
    return d.getTime();
  }
  const days = frequency === "biweekly" ? 14 : (customIntervalDays ?? 30);
  return startDate + seq * days * 24 * 60 * 60 * 1000;
}

// Splits `total` across `count` installments, giving any rounding
// remainder to the last one so the sum always exactly equals `total`.
function splitEvenly(total: number, count: number): number[] {
  const per = Math.floor(total / count);
  const remainder = total - per * count;
  return Array.from({ length: count }, (_, i) => per + (i === count - 1 ? remainder : 0));
}

export const listPlansForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("paymentPlans")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

export const getPlanWithInstallments = query({
  args: { planId: v.id("paymentPlans") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (plan === null) return null;
    const installments = await ctx.db
      .query("installments")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
    return { plan, installments: installments.sort((a, b) => a.seq - b.seq) };
  },
});

// Spec Sec7.6: "surfaces on the Outstanding tab." listCoursesForPatient-style
// flat query, joined to patient name the same way listPaymentsTodayWithNames
// already does, so the Outstanding tab doesn't need an N-query fan-out.
export const listOverdueInstallmentsWithNames = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const overdue = await ctx.db
      .query("installments")
      .withIndex("by_due", (q) => q.lt("dueDate", Date.now()))
      .filter((q) => q.eq(q.field("status"), "overdue"))
      .collect();
    const plans = await Promise.all([...new Set(overdue.map((i) => i.planId))].map((id) => ctx.db.get(id)));
    const planById = new Map(plans.filter((p) => p !== null).map((p) => [p._id, p]));
    const patients = await Promise.all(
      [...new Set(plans.filter((p) => p !== null).map((p) => p.patientId))].map((id) => ctx.db.get(id)),
    );
    const patientById = new Map(patients.filter((p) => p !== null).map((p) => [p._id, p]));
    return overdue.map((inst) => {
      const plan = planById.get(inst.planId);
      const patient = plan ? patientById.get(plan.patientId) : undefined;
      return {
        ...inst,
        patientId: plan?.patientId,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : "—",
      };
    });
  },
});

export const createPaymentPlan = mutation({
  args: {
    patientId: v.id("patients"),
    courseId: v.optional(v.id("courses")),
    installmentCount: v.number(),
    frequency: FREQUENCY,
    customIntervalDays: v.optional(v.number()),
    startDate: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.installmentCount < 1) {
      throw new ConvexError("Need at least one installment");
    }
    const patient = await ctx.db.get(args.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }
    if (patient.balance <= 0) {
      throw new ConvexError("This patient has no balance to schedule");
    }
    const existingActive = await ctx.db
      .query("paymentPlans")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (existingActive !== null) {
      throw new ConvexError("This patient already has an active payment plan");
    }

    const basisAmount = patient.balance;
    const planId = await ctx.db.insert("paymentPlans", {
      patientId: args.patientId,
      courseId: args.courseId,
      basisAmount,
      status: "active",
      createdBy: user._id,
      createdAt: Date.now(),
    });

    const amounts = splitEvenly(basisAmount, args.installmentCount);
    for (let seq = 0; seq < args.installmentCount; seq++) {
      await ctx.db.insert("installments", {
        planId,
        seq,
        dueDate: addInterval(args.startDate, args.frequency, seq, args.customIntervalDays),
        amount: amounts[seq],
        status: "pending",
      });
    }

    await writeAudit(ctx, {
      actorId: user._id,
      action: "plan.create",
      entity: "paymentPlans",
      entityId: planId,
      after: { basisAmount, installmentCount: args.installmentCount, frequency: args.frequency },
    });
    return planId;
  },
});

// Spec Sec7.6: "Hand-edit any individual amount or date afterwards."
export const updateInstallment = mutation({
  args: {
    installmentId: v.id("installments"),
    amount: v.optional(v.number()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const installment = await ctx.db.get(args.installmentId);
    if (installment === null) {
      throw new ConvexError("Installment not found");
    }
    const patch: { amount?: number; dueDate?: number } = {};
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    await ctx.db.patch(args.installmentId, patch);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "installment.update",
      entity: "installments",
      entityId: args.installmentId,
      before: { amount: installment.amount, dueDate: installment.dueDate },
      after: patch,
    });
  },
});

// Spec Sec7.6: "Recalculate -- the course grew or shrank; regenerate
// remaining installments from the new balance." Paid installments are
// historical record and untouched; only pending/overdue ones are re-split.
export const recalculatePlan = mutation({
  args: { planId: v.id("paymentPlans") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (plan === null) {
      throw new ConvexError("Plan not found");
    }
    if (plan.status !== "active") {
      throw new ConvexError("Only an active plan can be recalculated");
    }
    const patient = await ctx.db.get(plan.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }
    if (patient.balance <= 0) {
      throw new ConvexError("Nothing left to recalculate -- the balance is already clear");
    }
    const installments = await ctx.db
      .query("installments")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
    const remaining = installments
      .filter((i) => i.status === "pending" || i.status === "overdue")
      .sort((a, b) => a.seq - b.seq);
    if (remaining.length === 0) {
      throw new ConvexError("No remaining installments to recalculate");
    }

    const now = Date.now();
    const amounts = splitEvenly(patient.balance, remaining.length);
    for (const [i, inst] of remaining.entries()) {
      await ctx.db.patch(inst._id, {
        amount: amounts[i],
        status: inst.dueDate < now ? "overdue" : "pending",
      });
    }
    await writeAudit(ctx, {
      actorId: user._id,
      action: "plan.recalculate",
      entity: "paymentPlans",
      entityId: args.planId,
      after: { newBasis: patient.balance, remainingCount: remaining.length },
    });
  },
});

// Spec Sec7.6: "Settle balance -- take one payment for everything
// remaining; plan closes automatically."
export const settlePlan = mutation({
  args: { planId: v.id("paymentPlans"), method: PAYMENT_METHOD },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (plan === null) {
      throw new ConvexError("Plan not found");
    }
    if (plan.status !== "active") {
      throw new ConvexError("This plan isn't active");
    }
    const patient = await ctx.db.get(plan.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }
    if (patient.balance <= 0) {
      throw new ConvexError("Nothing left to settle");
    }

    const allocations = await allocateFifo(ctx, plan.patientId, patient.balance);
    const paymentId = await ctx.db.insert("payments", {
      patientId: plan.patientId,
      amount: patient.balance,
      method: args.method,
      receivedAt: Date.now(),
      receivedBy: user._id,
      allocations,
      planId: args.planId,
    });
    await recomputeBalance(ctx, plan.patientId);

    const installments = await ctx.db
      .query("installments")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
    for (const inst of installments) {
      if (inst.status !== "cancelled") {
        await ctx.db.patch(inst._id, { status: "paid" });
      }
    }
    await ctx.db.patch(args.planId, { status: "completed" });

    await writeAudit(ctx, {
      actorId: user._id,
      action: "plan.settle",
      entity: "paymentPlans",
      entityId: args.planId,
      after: { paymentId, amount: patient.balance },
    });
    return paymentId;
  },
});

// Spec Sec7.6: "Cancel plan -- the ledger is untouched; only the schedule
// disappears." No charge/payment is touched here.
export const cancelPlan = mutation({
  args: { planId: v.id("paymentPlans") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (plan === null) {
      throw new ConvexError("Plan not found");
    }
    if (plan.status !== "active") {
      throw new ConvexError("This plan isn't active");
    }
    await ctx.db.patch(args.planId, { status: "cancelled", cancelledAt: Date.now() });
    const installments = await ctx.db
      .query("installments")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
    for (const inst of installments) {
      if (inst.status === "pending" || inst.status === "overdue") {
        await ctx.db.patch(inst._id, { status: "cancelled" });
      }
    }
    await writeAudit(ctx, {
      actorId: user._id,
      action: "plan.cancel",
      entity: "paymentPlans",
      entityId: args.planId,
    });
  },
});

// Spec Sec7.6/Sec15: "Nightly cron flips pending -> overdue." Registered
// in crons.ts. Not a public mutation -- nothing in the UI should ever call
// this directly, it's a scheduled sweep only.
export const sweepOverdueInstallments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("installments")
      .withIndex("by_due", (q) => q.lt("dueDate", now))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    for (const installment of due) {
      await ctx.db.patch(installment._id, { status: "overdue" });
    }
  },
});
