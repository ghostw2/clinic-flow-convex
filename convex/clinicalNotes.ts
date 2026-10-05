import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCanViewClinicalNotes, requireOwner } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";

const NOTE_VALUE = v.object({ fieldId: v.string(), value: v.any() });

const NOTE_FIELD = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("textarea"),
    v.literal("number"),
    v.literal("checkbox"),
    v.literal("radio"),
    v.literal("dropdown"),
    v.literal("date"),
    v.literal("signature"),
  ),
  options: v.optional(v.array(v.string())),
});

export const listNoteTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireCanViewClinicalNotes(ctx);
    return await ctx.db
      .query("noteTemplates")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
  },
});

// Spec Sec13: "Clinical -- note templates." The seeds in
// lib/constants.ts have carried a comment since early in the build: "the
// template *builder* UI itself is a later step." This is that step --
// owner-only CRUD over noteTemplates, mirroring the Services/Clinic
// settings pattern (requireOwner, writeAudit, patch-based updates).
export const listAllNoteTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db.query("noteTemplates").collect();
  },
});

export const createNoteTemplate = mutation({
  args: { name: v.string(), fields: v.array(NOTE_FIELD) },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const templateId = await ctx.db.insert("noteTemplates", {
      name: args.name,
      fields: args.fields,
      active: true,
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "noteTemplate.create",
      entity: "noteTemplates",
      entityId: templateId,
      after: args,
    });
    return templateId;
  },
});

export const updateNoteTemplate = mutation({
  args: {
    templateId: v.id("noteTemplates"),
    name: v.optional(v.string()),
    fields: v.optional(v.array(NOTE_FIELD)),
  },
  handler: async (ctx, { templateId, ...patch }) => {
    const user = await requireOwner(ctx);
    const before = await ctx.db.get(templateId);
    if (before === null) {
      throw new ConvexError("Template not found");
    }
    await ctx.db.patch(templateId, patch);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "noteTemplate.update",
      entity: "noteTemplates",
      entityId: templateId,
      before,
      after: patch,
    });
  },
});

export const setNoteTemplateActive = mutation({
  args: { templateId: v.id("noteTemplates"), active: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    await ctx.db.patch(args.templateId, { active: args.active });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "noteTemplate.setActive",
      entity: "noteTemplates",
      entityId: args.templateId,
      after: { active: args.active },
    });
  },
});

// Spec Sec8: "Chart per patient." Gated the same way as the templates
// themselves -- an assistant can't see that clinical notes exist for a
// patient at all, not just open them.
export const listNotesForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireCanViewClinicalNotes(ctx);
    return await ctx.db
      .query("clinicalNotes")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

export const getNote = query({
  args: { noteId: v.id("clinicalNotes") },
  handler: async (ctx, args) => {
    await requireCanViewClinicalNotes(ctx);
    return await ctx.db.get(args.noteId);
  },
});

export const createNote = mutation({
  args: {
    patientId: v.id("patients"),
    templateId: v.id("noteTemplates"),
    appointmentId: v.optional(v.id("appointments")),
    values: v.array(NOTE_VALUE),
  },
  handler: async (ctx, args) => {
    const user = await requireCanViewClinicalNotes(ctx);
    const template = await ctx.db.get(args.templateId);
    if (template === null) {
      throw new ConvexError("Note template not found");
    }
    const noteId = await ctx.db.insert("clinicalNotes", {
      patientId: args.patientId,
      templateId: args.templateId,
      templateName: template.name,
      authorId: user._id,
      authorName: user.name ?? user.email ?? "Unknown",
      appointmentId: args.appointmentId,
      values: args.values,
      status: "draft",
      createdAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinicalNote.create",
      entity: "clinicalNotes",
      entityId: noteId,
      after: { templateName: template.name, patientId: args.patientId },
    });
    return noteId;
  },
});

export const updateNoteDraft = mutation({
  args: {
    noteId: v.id("clinicalNotes"),
    values: v.array(NOTE_VALUE),
  },
  handler: async (ctx, args) => {
    const user = await requireCanViewClinicalNotes(ctx);
    const note = await ctx.db.get(args.noteId);
    if (note === null) {
      throw new ConvexError("Note not found");
    }
    if (note.status !== "draft") {
      throw new ConvexError("Signed notes can't be edited directly -- add an amendment instead");
    }
    await ctx.db.patch(args.noteId, { values: args.values });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinicalNote.updateDraft",
      entity: "clinicalNotes",
      entityId: args.noteId,
      before: { values: note.values },
      after: { values: args.values },
    });
  },
});

// Spec Sec8: "Note signing -- clinician e-signature locks the note." Once
// signed, updateNoteDraft refuses further edits; amendNote is the only way
// to add anything after this point.
export const signNote = mutation({
  args: { noteId: v.id("clinicalNotes") },
  handler: async (ctx, args) => {
    const user = await requireCanViewClinicalNotes(ctx);
    const note = await ctx.db.get(args.noteId);
    if (note === null) {
      throw new ConvexError("Note not found");
    }
    if (note.status === "signed") {
      throw new ConvexError("This note is already signed");
    }
    const signedAt = Date.now();
    await ctx.db.patch(args.noteId, { status: "signed", signedAt });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinicalNote.sign",
      entity: "clinicalNotes",
      entityId: args.noteId,
      after: { signedAt, signedBy: user.name ?? user.email },
    });
  },
});

// Spec Sec8: "Amend-after-sign -- amendments append and appear in the audit
// trail, never overwrite. Legally required." The original signed `values`
// are never touched; this only ever appends to `amendments`.
export const amendNote = mutation({
  args: { noteId: v.id("clinicalNotes"), text: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCanViewClinicalNotes(ctx);
    const note = await ctx.db.get(args.noteId);
    if (note === null) {
      throw new ConvexError("Note not found");
    }
    if (note.status !== "signed") {
      throw new ConvexError("Only signed notes can be amended -- edit the draft directly instead");
    }
    const amendment = {
      text: args.text,
      authorId: user._id,
      authorName: user.name ?? user.email ?? "Unknown",
      createdAt: Date.now(),
    };
    await ctx.db.patch(args.noteId, {
      amendments: [...(note.amendments ?? []), amendment],
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "clinicalNote.amend",
      entity: "clinicalNotes",
      entityId: args.noteId,
      after: amendment,
    });
  },
});
