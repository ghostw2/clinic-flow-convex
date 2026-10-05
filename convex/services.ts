import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";

export const listServices = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.activeOnly) {
      return await ctx.db
        .query("services")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
    }
    return await ctx.db.query("services").collect();
  },
});

export const getService = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.serviceId);
  },
});

export const createService = mutation({
  args: {
    name: v.string(),
    durationMin: v.number(),
    price: v.number(),
    colour: v.string(),
    vatRate: v.number(),
    vatExemptReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const serviceId = await ctx.db.insert("services", {
      ...args,
      active: true,
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "service.create",
      entity: "services",
      entityId: serviceId,
      after: args,
    });
    return serviceId;
  },
});

// Spec Sec7.3: "Price on the charge is a snapshot. Changing a service's
// price later must never retroactively alter someone's balance." This
// mutation only ever touches the `services` row -- existing `charges` rows
// keep their own `unitPrice` forever.
export const updateService = mutation({
  args: {
    serviceId: v.id("services"),
    name: v.optional(v.string()),
    durationMin: v.optional(v.number()),
    price: v.optional(v.number()),
    colour: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    vatExemptReason: v.optional(v.string()),
  },
  handler: async (ctx, { serviceId, ...patch }) => {
    const user = await requireOwner(ctx);
    const before = await ctx.db.get(serviceId);
    await ctx.db.patch(serviceId, patch);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "service.update",
      entity: "services",
      entityId: serviceId,
      before,
      after: patch,
    });
  },
});

export const setServiceActive = mutation({
  args: { serviceId: v.id("services"), active: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    await ctx.db.patch(args.serviceId, { active: args.active });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "service.setActive",
      entity: "services",
      entityId: args.serviceId,
      after: { active: args.active },
    });
  },
});
