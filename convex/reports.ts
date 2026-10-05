import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./lib/auth_helpers";

// Spec Sec10: "Revenue by period / service / payment method, new vs
// returning patients, no-show rate, course acceptance rate, installment
// collection rate. Date range picker, CSV export for the accountant."
// CSV generation itself happens client-side from this query's result (no
// backend file generation needed, same "stub PDF, do it in the browser"
// philosophy as receipts).
export const getFinancialReport = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_received", (q) => q.gte("receivedAt", args.startDate).lt("receivedAt", args.endDate))
      .collect();
    const charges = await ctx.db
      .query("charges")
      .withIndex("by_occurred", (q) => q.gte("occurredAt", args.startDate).lt("occurredAt", args.endDate))
      .filter((q) => q.eq(q.field("voidedAt"), undefined))
      .collect();

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCharged = charges.reduce((sum, c) => sum + c.amount, 0);

    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
    }

    const byServiceMap = new Map<string, number>();
    for (const c of charges) {
      const key = c.description;
      byServiceMap.set(key, (byServiceMap.get(key) ?? 0) + c.amount);
    }
    const byService = [...byServiceMap.entries()]
      .map(([description, amount]) => ({ description, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { totalCollected, totalCharged, byMethod, byService };
  },
});

export const getOperationsReport = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_start", (q) => q.gte("start", args.startDate).lt("start", args.endDate))
      .collect();
    const totalAppointments = appointments.length;
    const noShowCount = appointments.filter((a) => a.status === "no_show").length;
    const noShowRate = totalAppointments > 0 ? noShowCount / totalAppointments : null;

    // Courses/patients are small tables at this app's scale (single clinic) --
    // same full-scan tradeoff patientSegmentCounts already makes.
    const courses = await ctx.db.query("courses").collect();
    const coursesInRange = courses.filter((c) => c.createdAt >= args.startDate && c.createdAt < args.endDate);
    const coursesProposed = coursesInRange.filter((c) => c.status !== "draft");
    const coursesAccepted = coursesInRange.filter(
      (c) => c.status === "accepted" || c.status === "in_progress" || c.status === "completed",
    );
    const courseAcceptanceRate = coursesProposed.length > 0 ? coursesAccepted.length / coursesProposed.length : null;

    const installments = await ctx.db
      .query("installments")
      .withIndex("by_due", (q) => q.gte("dueDate", args.startDate).lt("dueDate", args.endDate))
      .collect();
    const installmentsDue = installments.filter((i) => i.status !== "cancelled");
    const installmentsPaid = installmentsDue.filter((i) => i.status === "paid");
    const installmentCollectionRate =
      installmentsDue.length > 0 ? installmentsPaid.length / installmentsDue.length : null;

    const patients = await ctx.db.query("patients").collect();
    const newPatients = patients.filter(
      (p) => p._creationTime >= args.startDate && p._creationTime < args.endDate,
    ).length;
    const completedPatientIds = new Set(
      appointments.filter((a) => a.status === "completed").map((a) => a.patientId),
    );
    const patientById = new Map(patients.map((p) => [p._id, p]));
    let returningPatients = 0;
    for (const pid of completedPatientIds) {
      const p = patientById.get(pid);
      if (p && p._creationTime < args.startDate) returningPatients++;
    }

    return {
      totalAppointments,
      noShowCount,
      noShowRate,
      coursesProposed: coursesProposed.length,
      coursesAccepted: coursesAccepted.length,
      courseAcceptanceRate,
      installmentsDueCount: installmentsDue.length,
      installmentsPaidCount: installmentsPaid.length,
      installmentCollectionRate,
      newPatients,
      returningPatients,
    };
  },
});
