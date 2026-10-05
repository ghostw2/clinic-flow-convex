import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Spec Sec7.2: "Denormalize `balance` onto the patient document,
// recomputed in the same mutation that writes a charge or payment. Convex
// mutations are transactional, so this can't drift." Called from
// billing/charges.ts and billing/payments.ts at the end of every mutation
// that inserts/voids a charge or inserts a payment -- never registered as
// its own callable Convex function.
export async function recomputeBalance(
  ctx: MutationCtx,
  patientId: Id<"patients">,
): Promise<number> {
  const charges = await ctx.db
    .query("charges")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .collect();
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .collect();

  const totalCharges = charges
    .filter((c) => c.voidedAt === undefined)
    .reduce((sum, c) => sum + c.amount, 0);
  // Refunds are inserted as negative payments (spec Sec7.4), so a plain sum
  // already nets them out -- no separate credit ledger needed.
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  const balance = totalCharges - totalPayments;
  await ctx.db.patch(patientId, { balance });
  return balance;
}
