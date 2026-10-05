import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";
import { CLINIC_TYPES, LOCALE } from "./schema";

const workingHoursValidator = v.array(
  v.object({
    weekday: v.number(),
    openMin: v.number(),
    closeMin: v.number(),
    closed: v.boolean(),
  }),
);

export const getClinic = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("clinic").first();
  },
});

// Deliberately public (no requireUser): the /login screen shows the clinic
// name before the operator has signed in (design/png/01-login.png: "Sign in
// to Klinika Dentare Hoxha"). Returns only `name` -- address/NIPT/phone stay
// behind getClinic's auth check.
export const getClinicPublicInfo = query({
  args: {},
  handler: async (ctx) => {
    const clinic = await ctx.db.query("clinic").first();
    return clinic === null ? null : { name: clinic.name };
  },
});

// Enforces the singleton in code, per spec Sec2: "Clinic settings live in a
// singleton document."
export const initClinic = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    nipt: v.string(),
    phone: v.string(),
    timezone: v.string(),
    currency: v.string(),
    defaultLocale: LOCALE,
    clinicType: CLINIC_TYPES,
    workingHours: workingHoursValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const existing = await ctx.db.query("clinic").first();
    if (existing !== null) {
      throw new ConvexError("Clinic is already initialized");
    }
    const clinicId = await ctx.db.insert("clinic", args);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinic.init",
      entity: "clinic",
      entityId: clinicId,
      after: args,
    });
    return clinicId;
  },
});

export const updateClinicDetails = mutation({
  args: {
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    nipt: v.optional(v.string()),
    phone: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    defaultLocale: v.optional(LOCALE),
    clinicType: v.optional(CLINIC_TYPES),
    chargeCourseOn: v.optional(
      v.union(v.literal("acceptance"), v.literal("completion")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const clinic = await ctx.db.query("clinic").first();
    if (clinic === null) {
      throw new ConvexError("Clinic has not been initialized yet");
    }
    const before = clinic;
    await ctx.db.patch(clinic._id, args);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinic.updateDetails",
      entity: "clinic",
      entityId: clinic._id,
      before,
      after: args,
    });
  },
});

export const updateWorkingHours = mutation({
  args: { workingHours: workingHoursValidator },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const clinic = await ctx.db.query("clinic").first();
    if (clinic === null) {
      throw new ConvexError("Clinic has not been initialized yet");
    }
    const before = clinic.workingHours;
    await ctx.db.patch(clinic._id, { workingHours: args.workingHours });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinic.updateWorkingHours",
      entity: "clinic",
      entityId: clinic._id,
      before,
      after: args.workingHours,
    });
  },
});
