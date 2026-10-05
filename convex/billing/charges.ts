import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { requireOwner, requireUser } from "../lib/auth_helpers";
import { writeAudit } from "../lib/audit";
import { computeChargeAmount } from "../lib/money";
import { recomputeBalance } from "./balance";
import { syncInstallmentStatuses } from "./installmentSync";

// Called only from appointments.ts's updateAppointmentStatus when
// transitioning an appointment to "completed" -- spec Sec7.3 ("created
// automatically when an appointment is marked completed... at the
// service's current price") and Sec14's "Complete & Charge" critical loop.
// A plain function (not a registered Convex mutation) so it runs inside
// the caller's existing transaction rather than a separate one.
export async function createChargeFromAppointment(
  ctx: MutationCtx,
  args: {
    appointment: Doc<"appointments">;
    service: Doc<"services">;
    actorId: Id<"users">;
  },
): Promise<Id<"charges">> {
  const { appointment, service, actorId } = args;
  // Price is a SNAPSHOT (spec Sec7.3): later changes to service.price must
  // never retroactively alter a patient's balance, so we copy the value
  // now rather than referencing the service.
  const amount = computeChargeAmount({
    qty: 1,
    unitPrice: service.price,
    discount: 0,
  });
  const chargeId = await ctx.db.insert("charges", {
    patientId: appointment.patientId,
    source: "appointment",
    sourceId: appointment._id,
    serviceId: service._id,
    description: service.name,
    qty: 1,
    unitPrice: service.price,
    discount: 0,
    vatRate: service.vatRate,
    vatExemptReason: service.vatExemptReason,
    amount,
    occurredAt: Date.now(),
  });
  await recomputeBalance(ctx, appointment.patientId);
  await syncInstallmentStatuses(ctx, appointment.patientId);
  await writeAudit(ctx, {
    actorId,
    action: "charge.create.fromAppointment",
    entity: "charges",
    entityId: chargeId,
    after: { appointmentId: appointment._id, amount },
  });
  return chargeId;
}

export const createManualCharge = mutation({
  args: {
    patientId: v.id("patients"),
    description: v.string(),
    qty: v.number(),
    unitPrice: v.number(),
    discount: v.number(),
    vatRate: v.number(),
    vatExemptReason: v.optional(v.string()),
    serviceId: v.optional(v.id("services")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const amount = computeChargeAmount(args);
    const chargeId = await ctx.db.insert("charges", {
      ...args,
      source: "manual",
      amount,
      occurredAt: Date.now(),
    });
    await recomputeBalance(ctx, args.patientId);
    await syncInstallmentStatuses(ctx, args.patientId);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "charge.create.manual",
      entity: "charges",
      entityId: chargeId,
      after: args,
    });
    return chargeId;
  },
});

// Spec Sec7.3: "Editable and voidable until covered by a payment
// allocation; voided charges stay visible with a reason."
export const voidCharge = mutation({
  args: { chargeId: v.id("charges"), voidReason: v.string() },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const charge = await ctx.db.get(args.chargeId);
    if (charge === null) {
      throw new ConvexError("Charge not found");
    }
    if (charge.voidedAt !== undefined) {
      throw new ConvexError("Charge is already voided");
    }

    const patientPayments = await ctx.db
      .query("payments")
      .withIndex("by_patient", (q) => q.eq("patientId", charge.patientId))
      .collect();
    const isCovered = patientPayments.some((p) =>
      p.allocations?.some((a) => a.chargeId === args.chargeId),
    );
    if (isCovered) {
      throw new ConvexError(
        "Cannot void a charge that a payment has already been allocated to",
      );
    }

    await ctx.db.patch(args.chargeId, {
      voidedAt: Date.now(),
      voidReason: args.voidReason,
    });
    await recomputeBalance(ctx, charge.patientId);
    await syncInstallmentStatuses(ctx, charge.patientId);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "charge.void",
      entity: "charges",
      entityId: args.chargeId,
      before: charge,
      after: { voidReason: args.voidReason },
    });
  },
});

export const listChargesForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("charges")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

// Feeds the future Finances "Today" tab (spec Sec10).
export const listChargesToday = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return await ctx.db
      .query("charges")
      .withIndex("by_occurred", (q) => q.gte("occurredAt", startOfDay.getTime()))
      .collect();
  },
});
