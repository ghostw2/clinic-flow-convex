import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";
import { createChargeFromAppointment } from "./billing/charges";
import { APPOINTMENT_STATUS } from "./schema";

type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ["confirmed", "arrived", "cancelled", "no_show"],
  confirmed: ["arrived", "cancelled", "no_show"],
  arrived: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
};

// Spec Sec6: "Double-booking prevention enforced in the mutation. Convex
// mutations are transactional, so this is genuinely airtight rather than
// best-effort." Queries the by_practitioner_start index for anything that
// starts before this window ends, then filters in-memory for a true
// overlap (existing.end > new.start) among non-cancelled appointments.
async function assertNoOverlap(
  ctx: MutationCtx,
  args: {
    practitionerId: Id<"users">;
    start: number;
    end: number;
    excludeAppointmentId?: Id<"appointments">;
  },
): Promise<void> {
  const candidates = await ctx.db
    .query("appointments")
    .withIndex("by_practitioner_start", (q) =>
      q.eq("practitionerId", args.practitionerId).lt("start", args.end),
    )
    .collect();
  const overlap = candidates.find(
    (a) =>
      a._id !== args.excludeAppointmentId &&
      a.end > args.start &&
      a.status !== "cancelled" &&
      a.status !== "no_show",
  );
  if (overlap) {
    throw new ConvexError(
      "This practitioner already has an appointment in that time slot",
    );
  }
}

// Shared by updateAppointmentStatus, checkIn and cancelAppointment so the
// transition-legality check and the Complete & Charge side effect live in
// exactly one place.
async function transitionStatus(
  ctx: MutationCtx,
  actorId: Id<"users">,
  appointmentId: Id<"appointments">,
  newStatus: AppointmentStatus,
): Promise<void> {
  const appointment = await ctx.db.get(appointmentId);
  if (appointment === null) {
    throw new ConvexError("Appointment not found");
  }
  const allowed = ALLOWED_TRANSITIONS[appointment.status as AppointmentStatus];
  if (!allowed.includes(newStatus)) {
    throw new ConvexError(
      `Cannot move an appointment from "${appointment.status}" to "${newStatus}"`,
    );
  }

  await ctx.db.patch(appointmentId, { status: newStatus });

  // Spec Sec14's critical loop: "Complete & Charge" happens as one call --
  // completing an appointment creates its charge in the SAME mutation.
  if (newStatus === "completed") {
    const service = await ctx.db.get(appointment.serviceId);
    if (service === null) {
      throw new ConvexError("Service not found");
    }
    const chargeId = await createChargeFromAppointment(ctx, {
      appointment,
      service,
      actorId,
    });
    await ctx.db.patch(appointmentId, { chargeId });
    // Denormalized onto the patient so the patients list (step 3) can show
    // "last visit"/"last service" per row without an N+1 query -- see
    // schema.ts's comment on patients.lastVisitAt.
    await ctx.db.patch(appointment.patientId, {
      lastVisitAt: appointment.start,
      lastServiceName: service.name,
      lastServiceColour: service.colour,
    });
  }

  if (newStatus === "no_show") {
    const patient = await ctx.db.get(appointment.patientId);
    if (patient !== null) {
      await ctx.db.patch(appointment.patientId, {
        noShowCount: (patient.noShowCount ?? 0) + 1,
      });
    }
  }

  await writeAudit(ctx, {
    actorId,
    action: "appointment.updateStatus",
    entity: "appointments",
    entityId: appointmentId,
    before: { status: appointment.status },
    after: { status: newStatus },
  });
}

export const getAppointment = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.appointmentId);
  },
});

export const listAppointmentsByDay = query({
  args: {
    dayStart: v.number(),
    dayEnd: v.number(),
    practitionerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.practitionerId !== undefined) {
      return await ctx.db
        .query("appointments")
        .withIndex("by_practitioner_start", (q) =>
          q
            .eq("practitionerId", args.practitionerId!)
            .gte("start", args.dayStart)
            .lt("start", args.dayEnd),
        )
        .collect();
    }
    return await ctx.db
      .query("appointments")
      .withIndex("by_start", (q) =>
        q.gte("start", args.dayStart).lt("start", args.dayEnd),
      )
      .collect();
  },
});

export const listAppointmentsByWeek = query({
  args: {
    weekStart: v.number(),
    weekEnd: v.number(),
    practitionerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.practitionerId !== undefined) {
      return await ctx.db
        .query("appointments")
        .withIndex("by_practitioner_start", (q) =>
          q
            .eq("practitionerId", args.practitionerId!)
            .gte("start", args.weekStart)
            .lt("start", args.weekEnd),
        )
        .collect();
    }
    return await ctx.db
      .query("appointments")
      .withIndex("by_start", (q) =>
        q.gte("start", args.weekStart).lt("start", args.weekEnd),
      )
      .collect();
  },
});

export const listAppointmentsForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("appointments")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

export const createAppointment = mutation({
  args: {
    patientId: v.id("patients"),
    practitionerId: v.id("users"),
    serviceId: v.id("services"),
    start: v.number(),
    end: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertNoOverlap(ctx, {
      practitionerId: args.practitionerId,
      start: args.start,
      end: args.end,
    });

    const [patient, practitioner, service] = await Promise.all([
      ctx.db.get(args.patientId),
      ctx.db.get(args.practitionerId),
      ctx.db.get(args.serviceId),
    ]);
    if (patient === null || practitioner === null || service === null) {
      throw new ConvexError("Patient, practitioner or service not found");
    }

    const appointmentId = await ctx.db.insert("appointments", {
      patientId: args.patientId,
      practitionerId: args.practitionerId,
      serviceId: args.serviceId,
      start: args.start,
      end: args.end,
      status: "booked",
      notes: args.notes,
      patientName: `${patient.firstName} ${patient.lastName}`,
      practitionerName: practitioner.name ?? "Practitioner",
      serviceName: service.name,
      serviceColour: service.colour,
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "appointment.create",
      entity: "appointments",
      entityId: appointmentId,
      after: args,
    });
    return appointmentId;
  },
});

// Spec Sec6: "Walk-in button -- creates an appointment starting now, for an
// unbooked patient, in one click. Critical for a one-person clinic."
export const createWalkIn = mutation({
  args: {
    patientId: v.id("patients"),
    practitionerId: v.id("users"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const [patient, practitioner, service] = await Promise.all([
      ctx.db.get(args.patientId),
      ctx.db.get(args.practitionerId),
      ctx.db.get(args.serviceId),
    ]);
    if (patient === null || practitioner === null || service === null) {
      throw new ConvexError("Patient, practitioner or service not found");
    }

    const start = Date.now();
    const end = start + service.durationMin * 60_000;
    await assertNoOverlap(ctx, { practitionerId: args.practitionerId, start, end });

    const appointmentId = await ctx.db.insert("appointments", {
      patientId: args.patientId,
      practitionerId: args.practitionerId,
      serviceId: args.serviceId,
      start,
      end,
      status: "arrived", // already physically present
      patientName: `${patient.firstName} ${patient.lastName}`,
      practitionerName: practitioner.name ?? "Practitioner",
      serviceName: service.name,
      serviceColour: service.colour,
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "appointment.createWalkIn",
      entity: "appointments",
      entityId: appointmentId,
      after: { patientId: args.patientId, practitionerId: args.practitionerId },
    });
    return appointmentId;
  },
});

// Supports drag-move/resize from the calendar day view (spec Sec6).
// `practitionerId` is optional: present only when a drag crosses into a
// different practitioner's column, so a same-column move/resize doesn't
// pay for a practitioner lookup it doesn't need.
export const rescheduleAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    start: v.number(),
    end: v.number(),
    practitionerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const appointment = await ctx.db.get(args.appointmentId);
    if (appointment === null) {
      throw new ConvexError("Appointment not found");
    }
    const practitionerId = args.practitionerId ?? appointment.practitionerId;
    await assertNoOverlap(ctx, {
      practitionerId,
      start: args.start,
      end: args.end,
      excludeAppointmentId: args.appointmentId,
    });

    const patch: {
      start: number;
      end: number;
      practitionerId?: Id<"users">;
      practitionerName?: string;
    } = { start: args.start, end: args.end };
    if (args.practitionerId !== undefined && args.practitionerId !== appointment.practitionerId) {
      const practitioner = await ctx.db.get(args.practitionerId);
      if (practitioner === null) {
        throw new ConvexError("Practitioner not found");
      }
      patch.practitionerId = args.practitionerId;
      patch.practitionerName = practitioner.name ?? "Practitioner";
    }

    await ctx.db.patch(args.appointmentId, patch);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "appointment.reschedule",
      entity: "appointments",
      entityId: args.appointmentId,
      before: { start: appointment.start, end: appointment.end, practitionerId: appointment.practitionerId },
      after: { start: args.start, end: args.end, practitionerId },
    });
  },
});

export const updateAppointmentStatus = mutation({
  args: { appointmentId: v.id("appointments"), status: APPOINTMENT_STATUS },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await transitionStatus(ctx, user._id, args.appointmentId, args.status);
  },
});

// Step 4's appointment panel: a free-text visit note (spec Sec8's structured
// clinical notes/templates are Phase 2 -- this is just the existing
// `appointments.notes` field, made editable on its own rather than only at
// creation/cancellation).
export const updateAppointmentNotes = mutation({
  args: { appointmentId: v.id("appointments"), notes: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const appointment = await ctx.db.get(args.appointmentId);
    if (appointment === null) {
      throw new ConvexError("Appointment not found");
    }
    await ctx.db.patch(args.appointmentId, { notes: args.notes });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "appointment.updateNotes",
      entity: "appointments",
      entityId: args.appointmentId,
    });
  },
});

// Thin, distinctly-named wrapper over transitionStatus so the "check-in
// flow" UI action from spec Sec6 has its own function to call.
export const checkIn = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await transitionStatus(ctx, user._id, args.appointmentId, "arrived");
  },
});

export const cancelAppointment = mutation({
  args: { appointmentId: v.id("appointments"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await transitionStatus(ctx, user._id, args.appointmentId, "cancelled");
    if (args.reason !== undefined) {
      await ctx.db.patch(args.appointmentId, { notes: args.reason });
    }
  },
});
