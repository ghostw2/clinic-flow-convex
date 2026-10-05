import { MutationCtx } from "../_generated/server";
import { DOCUMENT_PREFIX, DocumentKind } from "./constants";

// Transactional per-kind-per-year document numbering (spec Sec7.9): "use
// RC-2026-0042, FT-2026-0007 -- deliberately unlike the fiscal
// 12/2026/TCRcode format... allocated transactionally in a counter
// document, only on issue, never on draft." Read-modify-write happens
// inside the SAME mutation that issues the document, so Convex's
// transactional guarantee means two concurrent receipts can never collide.
export async function allocateDocumentNumber(
  ctx: MutationCtx,
  kind: DocumentKind,
  year: number,
): Promise<string> {
  const prefix = DOCUMENT_PREFIX[kind];
  const key = `${prefix}-${year}`;
  const existing = await ctx.db
    .query("documentCounters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  const nextNumber = (existing?.lastNumber ?? 0) + 1;
  if (existing) {
    await ctx.db.patch(existing._id, { lastNumber: nextNumber });
  } else {
    await ctx.db.insert("documentCounters", { key, lastNumber: nextNumber });
  }

  const padded = String(nextNumber).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}
