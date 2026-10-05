import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";
import { buildSearchBlob, normalizeAlbanian } from "./lib/normalize";
import { LOCALE } from "./schema";

const PATIENT_SEGMENT = v.union(
  v.literal("all"),
  v.literal("owesMoney"),
  v.literal("seenThisMonth"),
);

function startOfMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Step 3 (patients list, frame 07): sorted by last visit within the
// archived/not-archived partition via by_archived_lastVisit, with the
// segment tabs layered on as a `.filter()` over that same indexed range --
// small enough at this app's scale (one clinic) that a second index per
// segment isn't worth the write-side complexity.
export const listPatients = query({
  args: {
    archived: v.optional(v.boolean()),
    segment: v.optional(PATIENT_SEGMENT),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const archived = args.archived ?? false;
    let q = ctx.db
      .query("patients")
      .withIndex("by_archived_lastVisit", (idx) => idx.eq("archived", archived))
      .order("desc");
    if (args.segment === "owesMoney") {
      q = q.filter((f) => f.gt(f.field("balance"), 0));
    } else if (args.segment === "seenThisMonth") {
      q = q.filter((f) => f.gte(f.field("lastVisitAt"), startOfMonth()));
    }
    return await q.paginate(args.paginationOpts);
  },
});

// Counts backing the segment tab badges ("All · 412", "Owes money · 4" in
// frame 07). A single scan over non-archived patients -- fine at this
// app's scale (a few hundred patients, one clinic), and avoids fetching a
// full page per segment just to show a count.
export const patientSegmentCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_archived_lastVisit", (idx) => idx.eq("archived", false))
      .collect();
    const monthStart = startOfMonth();
    const debtors = patients.filter((p) => p.balance > 0);
    return {
      all: patients.length,
      owesMoney: debtors.length,
      owesMoneyTotal: debtors.reduce((sum, p) => sum + p.balance, 0),
      seenThisMonth: patients.filter((p) => (p.lastVisitAt ?? 0) >= monthStart).length,
    };
  },
});

// Step 5 (Dashboard "Owed to you", Finances "Outstanding"): patients with a
// balance, highest first. Same single-scan approach as
// patientSegmentCounts -- fine at this app's scale.
export const listTopDebtors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_archived_lastVisit", (idx) => idx.eq("archived", false))
      .collect();
    return patients
      .filter((p) => p.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, args.limit ?? 20);
  },
});

export const getPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.patientId);
  },
});

// Spec Sec11: "Access audit log -- who opened which patient record, when."
// Queries can't write, so this is a separate mutation the patient record
// page fires once on open, rather than a side effect of getPatient itself.
export const logPatientAccess = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "patient.access",
      entity: "patients",
      entityId: args.patientId,
    });
  },
});

// Spec Sec5: "Registry with full-text search across name, phone and
// personal ID via a denormalized searchBlob field."
export const searchPatients = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const term = normalizeAlbanian(args.term);
    if (term.length === 0) return [];
    return await ctx.db
      .query("patients")
      .withSearchIndex("search_patients", (q) =>
        q.search("searchBlob", term),
      )
      .take(20);
  },
});

// Spec Sec5: "Duplicate detection on phone / NID at creation." Warns but
// doesn't hard-block -- the operator decides.
export const checkDuplicate = query({
  args: { phone: v.optional(v.string()), nid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const matches = [];
    if (args.phone) {
      matches.push(
        ...(await ctx.db
          .query("patients")
          .withIndex("by_phone", (q) => q.eq("phone", args.phone!))
          .filter((q) => q.eq(q.field("archived"), false))
          .collect()),
      );
    }
    if (args.nid) {
      matches.push(
        ...(await ctx.db
          .query("patients")
          .withIndex("by_nid", (q) => q.eq("nid", args.nid))
          .filter((q) => q.eq(q.field("archived"), false))
          .collect()),
      );
    }
    return matches;
  },
});

export const createPatient = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    dob: v.optional(v.number()),
    gender: v.optional(
      v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    ),
    nid: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(
      v.object({ name: v.string(), phone: v.string() }),
    ),
    referralSource: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    language: LOCALE,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const duplicatesByPhone = await ctx.db
      .query("patients")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .filter((q) => q.eq(q.field("archived"), false))
      .collect();
    const duplicatesByNid = args.nid
      ? await ctx.db
          .query("patients")
          .withIndex("by_nid", (q) => q.eq("nid", args.nid))
          .filter((q) => q.eq(q.field("archived"), false))
          .collect()
      : [];
    const duplicateWarning =
      duplicatesByPhone.length > 0 || duplicatesByNid.length > 0;

    const searchBlob = buildSearchBlob(args);
    const patientId = await ctx.db.insert("patients", {
      ...args,
      searchBlob,
      balance: 0,
      archived: false,
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "patient.create",
      entity: "patients",
      entityId: patientId,
      after: args,
    });
    return { patientId, duplicateWarning };
  },
});

export const updatePatient = mutation({
  args: {
    patientId: v.id("patients"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    dob: v.optional(v.number()),
    gender: v.optional(
      v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    ),
    nid: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(
      v.object({ name: v.string(), phone: v.string() }),
    ),
    referralSource: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    language: v.optional(LOCALE),
  },
  handler: async (ctx, { patientId, ...patch }) => {
    const user = await requireUser(ctx);
    const before = await ctx.db.get(patientId);
    if (before === null) {
      throw new ConvexError("Patient not found");
    }

    const needsSearchBlobRebuild =
      patch.firstName !== undefined ||
      patch.lastName !== undefined ||
      patch.phone !== undefined ||
      patch.nid !== undefined;
    const searchBlob = needsSearchBlobRebuild
      ? buildSearchBlob({
          firstName: patch.firstName ?? before.firstName,
          lastName: patch.lastName ?? before.lastName,
          phone: patch.phone ?? before.phone,
          nid: patch.nid ?? before.nid,
        })
      : undefined;

    await ctx.db.patch(patientId, {
      ...patch,
      ...(searchBlob !== undefined ? { searchBlob } : {}),
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "patient.update",
      entity: "patients",
      entityId: patientId,
      before,
      after: patch,
    });
  },
});

// Spec Sec5: "Archive (soft-hide, retains for legal retention). Never
// hard-delete outside an erasure request."
export const archivePatient = mutation({
  args: { patientId: v.id("patients"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    await ctx.db.patch(args.patientId, { archived: true });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "patient.archive",
      entity: "patients",
      entityId: args.patientId,
      after: { reason: args.reason },
    });
  },
});

export const unarchivePatient = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    await ctx.db.patch(args.patientId, { archived: false });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "patient.unarchive",
      entity: "patients",
      entityId: args.patientId,
    });
  },
});
