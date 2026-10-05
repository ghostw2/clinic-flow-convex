import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { getCurrentUser, requireOwner, requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";

export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("users").collect();
  },
});

// Internal: called only from auth.ts's afterUserCreatedOrUpdated callback.
// Spec Sec3: the owner creates the second user directly (no invite flow), so
// the FIRST user ever created is auto-promoted to owner; anyone after that
// starts with no role until users.setRole assigns one.
export const bootstrapFirstOwner = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const anyExistingRole = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("role"), undefined))
      .first();
    if (anyExistingRole !== null) return; // an owner/assistant already exists
    await ctx.db.patch(args.userId, {
      role: "owner",
      isPractitioner: true,
    });
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("assistant")),
    isPractitioner: v.boolean(),
    colour: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireOwner(ctx);
    const target = await ctx.db.get(args.userId);
    if (target === null) {
      throw new ConvexError("User not found");
    }
    const before = {
      role: target.role,
      isPractitioner: target.isPractitioner,
      colour: target.colour,
    };
    await ctx.db.patch(args.userId, {
      role: args.role,
      isPractitioner: args.isPractitioner,
      colour: args.colour,
    });
    await writeAudit(ctx, {
      actorId: actor._id,
      action: "user.setRole",
      entity: "users",
      entityId: args.userId,
      before,
      after: args,
    });
  },
});

export const updateMyProfile = mutation({
  args: { name: v.optional(v.string()), colour: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, args);
  },
});
