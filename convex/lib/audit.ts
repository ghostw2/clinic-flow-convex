import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Write path for the audit trail (spec Sec11). Deliberately not exposed as
// its own public mutation -- audit rows must never be client-writable
// directly, only ever a side effect of a real clinical/financial mutation.
export async function writeAudit(
  ctx: MutationCtx,
  args: {
    actorId: Id<"users">;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: args.actorId,
    action: args.action,
    entity: args.entity,
    entityId: args.entityId,
    before: args.before,
    after: args.after,
    occurredAt: Date.now(),
  });
}
