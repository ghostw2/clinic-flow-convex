import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";
import { CLINIC_TYPE_SEED_NOTE_TEMPLATES, CLINIC_TYPE_SEED_SERVICES } from "./lib/constants";
import { CLINIC_TYPES } from "./schema";

// Checklist query backing spec Sec4 step 5: "Done -> dashboard with a
// checklist of what's still empty."
export const onboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const clinic = await ctx.db.query("clinic").first();
    const anyService = await ctx.db.query("services").first();
    const anyPatient = await ctx.db.query("patients").first();
    const anyAppointment = await ctx.db.query("appointments").first();
    return {
      clinicExists: clinic !== null,
      onboardingCompleted: clinic?.onboardingCompletedAt !== undefined,
      servicesSeeded: anyService !== null,
      workingHoursSet: (clinic?.workingHours.length ?? 0) > 0,
      hasPatient: anyPatient !== null,
      hasAppointment: anyAppointment !== null,
    };
  },
});

// Spec Sec4 step 3: seeded services are meant to be *edited*, not created
// from scratch. Only seeds if the services table is still empty, so
// re-running this after a clinic has customized its services is a no-op.
export const seedClinicType = mutation({
  args: { clinicType: CLINIC_TYPES },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const clinic = await ctx.db.query("clinic").first();
    if (clinic === null) {
      throw new ConvexError("Clinic has not been initialized yet");
    }
    await ctx.db.patch(clinic._id, { clinicType: args.clinicType });

    const anyService = await ctx.db.query("services").first();
    if (anyService !== null) return;

    const seeds = CLINIC_TYPE_SEED_SERVICES[args.clinicType];
    for (const seed of seeds) {
      await ctx.db.insert("services", { ...seed, active: true });
    }

    const noteTemplateSeeds = CLINIC_TYPE_SEED_NOTE_TEMPLATES[args.clinicType];
    for (const seed of noteTemplateSeeds) {
      await ctx.db.insert("noteTemplates", { ...seed, active: true });
    }

    await writeAudit(ctx, {
      actorId: user._id,
      action: "onboarding.seedClinicType",
      entity: "clinic",
      entityId: clinic._id,
      after: { clinicType: args.clinicType, seededCount: seeds.length },
    });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireOwner(ctx);
    const clinic = await ctx.db.query("clinic").first();
    if (clinic === null) {
      throw new ConvexError("Clinic has not been initialized yet");
    }
    await ctx.db.patch(clinic._id, { onboardingCompletedAt: Date.now() });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "onboarding.complete",
      entity: "clinic",
      entityId: clinic._id,
    });
  },
});
