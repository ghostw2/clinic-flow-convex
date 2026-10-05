import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new ConvexError("Not authenticated");
  }
  return user;
}

export async function requireOwner(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "owner") {
    throw new ConvexError("Only the clinic owner can do this");
  }
  return user;
}

// NOTE: this is deliberately NOT applied to `patients.notes` (the free-text
// CRM/internal-notes field from spec Sec5). The "assistant can't open
// clinical notes" rule (Sec3, Law 124/2024) is about the separate clinical
// chart/documentation feature in Sec8, which is Phase 2 and doesn't exist
// yet -- gating patients.notes behind it would conflate two different
// fields. Apply this helper once the real clinical-notes table ships.
export async function requireCanViewClinicalNotes(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role === "assistant") {
    throw new ConvexError("Assistants cannot open clinical notes");
  }
  return user;
}

export function idToString(id: Id<any>): string {
  return id as unknown as string;
}
