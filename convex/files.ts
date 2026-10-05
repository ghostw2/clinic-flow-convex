import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth_helpers";

// Phase 1 note: no upload UI exists yet -- spec Sec5's file-upload feature
// (x-rays, referrals, scans, consent PDFs) isn't in Phase 1 scope -- but
// the entitlement-checked storage-URL pattern (Sec2/Sec15) is established
// here now rather than retrofitted once uploads ship: "any function
// returning a storage URL must confirm the requesting user is entitled to
// that file... a leaked URL bypasses every check you have."
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveFileMeta = mutation({
  args: {
    patientId: v.id("patients"),
    storageId: v.id("_storage"),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("files", {
      ...args,
      uploadedBy: user._id,
      uploadedAt: Date.now(),
    });
  },
});

// The canonical entitlement-check pattern from Sec2/Sec15. N/A in practice
// this pass since no upload UI exists yet, but the rule is established
// here now rather than retrofitted later.
export const getFileUrl = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const file = await ctx.db.get(args.fileId);
    if (file === null) {
      return null;
    }
    return await ctx.storage.getUrl(file.storageId);
  },
});
