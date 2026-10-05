import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOwner } from "./lib/auth_helpers";

// Read-only queries over the audit trail (spec Sec11). The write path lives
// in lib/audit.ts's writeAudit helper, called from inside other mutations
// -- never exposed as a directly callable public mutation, since audit
// rows must never be client-writable.
export const listAuditForEntity = query({
  args: { entity: v.string(), entityId: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entity", args.entity).eq("entityId", args.entityId),
      )
      .order("desc")
      .collect();
  },
});

export const listAuditRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_occurred")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
