import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Spec Sec7.6: "Payments apply to the balance, not to specific
// installments. Installments are marked paid as the balance drops past
// them." Called after every payment/refund that touches a patient's
// balance (billing/payments.ts, billing/completeVisit.ts, and
// billing/paymentPlans.ts's settlePlan) -- recomputes every non-cancelled
// installment's status from scratch each time, which correctly handles
// refunds pulling a "paid" installment back to pending just as naturally
// as a payment pushing one forward.
//
// Lives in its own file (not paymentPlans.ts) so payments.ts can import it
// without a payments.ts <-> paymentPlans.ts circular dependency, since
// paymentPlans.ts itself imports allocateFifo from payments.ts.
export async function syncInstallmentStatuses(
  ctx: MutationCtx,
  patientId: Id<"patients">,
): Promise<void> {
  const plan = await ctx.db
    .query("paymentPlans")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();
  if (!plan) return;
  const patient = await ctx.db.get(patientId);
  if (!patient) return;

  const installments = await ctx.db
    .query("installments")
    .withIndex("by_plan", (q) => q.eq("planId", plan._id))
    .collect();
  const sorted = [...installments].filter((i) => i.status !== "cancelled").sort((a, b) => a.seq - b.seq);

  // Hand-edited installments (spec Sec7.6: "hand-edit any individual amount
  // ... afterwards") can desync the schedule's own total from basisAmount --
  // e.g. one installment nudged up without the others nudged down. If the
  // patient owes nothing at all, every threshold has necessarily been
  // cleared regardless of that internal arithmetic, so this short-circuits
  // straight to "everything paid" instead of leaving a phantom pending
  // installment behind a fully-settled balance.
  if (patient.balance <= 0) {
    for (const inst of sorted) {
      if (inst.status !== "paid") {
        await ctx.db.patch(inst._id, { status: "paid" });
      }
    }
    if (plan.status === "active") {
      await ctx.db.patch(plan._id, { status: "completed" });
    }
    return;
  }

  // Assumes balance movement since plan creation is paying down this plan,
  // not unrelated new charges -- a reasonable simplification for a solo
  // clinic's single-active-plan-per-patient usage (enforced at creation).
  const totalPaidTowardPlan = Math.max(0, plan.basisAmount - patient.balance);
  const now = Date.now();
  let cumulative = 0;
  let allPaid = true;

  for (const inst of sorted) {
    cumulative += inst.amount;
    const shouldBePaid = cumulative <= totalPaidTowardPlan + 0.01;
    const nextStatus = shouldBePaid ? "paid" : inst.dueDate < now ? "overdue" : "pending";
    if (!shouldBePaid) allPaid = false;
    if (inst.status !== nextStatus) {
      await ctx.db.patch(inst._id, { status: nextStatus });
    }
  }

  if (allPaid && plan.status === "active") {
    await ctx.db.patch(plan._id, { status: "completed" });
  }
}
