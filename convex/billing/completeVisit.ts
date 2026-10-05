import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireUser } from "../lib/auth_helpers";
import { writeAudit } from "../lib/audit";
import { createChargeFromAppointment } from "./charges";
import { allocateFifo } from "./payments";
import { recomputeBalance } from "./balance";
import { syncInstallmentStatuses } from "./installmentSync";
import { PAYMENT_METHOD } from "../schema";

// Step 4's "critical loop" (spec Sec14): Complete & charge, in one atomic
// mutation rather than three separate client-side calls, since this is the
// one flow in the app where "charge got created but payment silently didn't"
// would actually lose money. Receipt generation stays a separate call
// (billing/documents.ts:generateReceipt) since a document is a view, never
// authoritative (spec Sec7.1) -- if it fails, the charge/payment are still
// correctly recorded and a receipt can be regenerated.
export const completeAppointmentAndCharge = mutation({
  args: {
    appointmentId: v.id("appointments"),
    // Extra line items beyond the appointment's own service charge (spec
    // Sec7.5's "+ Add item", e.g. "Anestezi lokale -- Add-on").
    extraCharges: v.array(v.object({ description: v.string(), amount: v.number() })),
    // Omitted entirely for "Not paying today? Add to balance".
    payment: v.optional(v.object({ amount: v.number(), method: PAYMENT_METHOD })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const appointment = await ctx.db.get(args.appointmentId);
    if (appointment === null) {
      throw new ConvexError("Appointment not found");
    }

    const chargeIds: Id<"charges">[] = [];

    if (appointment.status !== "completed") {
      const service = await ctx.db.get(appointment.serviceId);
      if (service === null) {
        throw new ConvexError("Service not found");
      }
      const baseChargeId = await createChargeFromAppointment(ctx, {
        appointment,
        service,
        actorId: user._id,
      });
      chargeIds.push(baseChargeId);
      await ctx.db.patch(args.appointmentId, { status: "completed", chargeId: baseChargeId });
      // Same denormalization as appointments.ts's transitionStatus -- this
      // mutation supersedes that completion path for appointments completed
      // through the calendar's Complete & charge flow.
      await ctx.db.patch(appointment.patientId, {
        lastVisitAt: appointment.start,
        lastServiceName: service.name,
        lastServiceColour: service.colour,
      });
    }

    for (const extra of args.extraCharges) {
      const chargeId = await ctx.db.insert("charges", {
        patientId: appointment.patientId,
        source: "manual",
        description: extra.description,
        qty: 1,
        unitPrice: extra.amount,
        discount: 0,
        vatRate: 0,
        amount: extra.amount,
        occurredAt: Date.now(),
      });
      chargeIds.push(chargeId);
    }
    if (chargeIds.length > 0) {
      await recomputeBalance(ctx, appointment.patientId);
      await syncInstallmentStatuses(ctx, appointment.patientId);
    }

    let paymentId: Id<"payments"> | undefined;
    if (args.payment !== undefined && args.payment.amount > 0) {
      const allocations = await allocateFifo(ctx, appointment.patientId, args.payment.amount);
      paymentId = await ctx.db.insert("payments", {
        patientId: appointment.patientId,
        amount: args.payment.amount,
        method: args.payment.method,
        receivedAt: Date.now(),
        receivedBy: user._id,
        allocations,
      });
      await recomputeBalance(ctx, appointment.patientId);
      await syncInstallmentStatuses(ctx, appointment.patientId);
    }

    await writeAudit(ctx, {
      actorId: user._id,
      action: "appointment.completeAndCharge",
      entity: "appointments",
      entityId: args.appointmentId,
      after: { chargeIds, paymentId, payment: args.payment },
    });

    return { chargeIds, paymentId };
  },
});
