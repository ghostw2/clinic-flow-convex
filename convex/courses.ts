import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/auth_helpers";
import { writeAudit } from "./lib/audit";
import { computeChargeAmount, computeDocumentTotals } from "./lib/money";
import { allocateDocumentNumber } from "./lib/counters";
import { recomputeBalance } from "./billing/balance";
import { LOCALE } from "./schema";

const TOOTH_REF = v.object({
  tooth: v.number(),
  surfaces: v.optional(v.array(v.string())),
});

export const listCoursesForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

export const getCourseWithItems = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) return null;
    const items = await ctx.db
      .query("courseItems")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    return { course, items };
  },
});

export const createCourse = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const courseId = await ctx.db.insert("courses", {
      patientId: args.patientId,
      status: "draft",
      discount: 0,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.create",
      entity: "courses",
      entityId: courseId,
      after: { patientId: args.patientId },
    });
    return courseId;
  },
});

async function requireDraftCourse(ctx: MutationCtx, courseId: Id<"courses">) {
  const course = await ctx.db.get(courseId);
  if (course === null) {
    throw new ConvexError("Course not found");
  }
  if (course.status !== "draft") {
    throw new ConvexError("Only a draft course can be edited this way");
  }
  return course;
}

export const addCourseItem = mutation({
  args: {
    courseId: v.id("courses"),
    serviceId: v.id("services"),
    toothRef: v.optional(TOOTH_REF),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) {
      throw new ConvexError("Course not found");
    }
    if (course.status === "completed" || course.status === "cancelled") {
      throw new ConvexError("Can't add items to a finished course");
    }
    const service = await ctx.db.get(args.serviceId);
    if (service === null) {
      throw new ConvexError("Service not found");
    }
    const itemId = await ctx.db.insert("courseItems", {
      courseId: args.courseId,
      serviceId: args.serviceId,
      serviceName: service.name,
      price: service.price,
      toothRef: args.toothRef,
      status: "planned",
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.addItem",
      entity: "courseItems",
      entityId: itemId,
      after: { courseId: args.courseId, serviceName: service.name },
    });
    return itemId;
  },
});

export const updateCourseItem = mutation({
  args: {
    courseItemId: v.id("courseItems"),
    price: v.optional(v.number()),
    toothRef: v.optional(TOOTH_REF),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get(args.courseItemId);
    if (item === null) {
      throw new ConvexError("Course item not found");
    }
    if (item.status !== "planned") {
      throw new ConvexError("Only a planned item can be edited");
    }
    const patch: { price?: number; toothRef?: typeof args.toothRef } = {};
    if (args.price !== undefined) patch.price = args.price;
    if (args.toothRef !== undefined) patch.toothRef = args.toothRef;
    await ctx.db.patch(args.courseItemId, patch);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.updateItem",
      entity: "courseItems",
      entityId: args.courseItemId,
      before: { price: item.price, toothRef: item.toothRef },
      after: patch,
    });
  },
});

export const removeCourseItem = mutation({
  args: { courseItemId: v.id("courseItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get(args.courseItemId);
    if (item === null) {
      throw new ConvexError("Course item not found");
    }
    await requireDraftCourse(ctx, item.courseId);
    await ctx.db.delete(args.courseItemId);
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.removeItem",
      entity: "courseItems",
      entityId: args.courseItemId,
      before: item,
    });
  },
});

export const setCourseDiscount = mutation({
  args: { courseId: v.id("courses"), discount: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await requireDraftCourse(ctx, args.courseId);
    await ctx.db.patch(args.courseId, { discount: args.discount });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.setDiscount",
      entity: "courses",
      entityId: args.courseId,
      before: { discount: course.discount },
      after: { discount: args.discount },
    });
  },
});

export const proposeCourse = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) {
      throw new ConvexError("Course not found");
    }
    if (course.status !== "draft") {
      throw new ConvexError("Only a draft course can be proposed");
    }
    const items = await ctx.db
      .query("courseItems")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    if (items.length === 0) {
      throw new ConvexError("Add at least one item before proposing");
    }
    await ctx.db.patch(args.courseId, { status: "proposed" });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.propose",
      entity: "courses",
      entityId: args.courseId,
    });
  },
});

export const acceptCourse = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) {
      throw new ConvexError("Course not found");
    }
    if (course.status !== "proposed") {
      throw new ConvexError("Only a proposed course can be accepted");
    }
    const acceptedAt = Date.now();
    await ctx.db.patch(args.courseId, { status: "accepted", acceptedAt });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.accept",
      entity: "courses",
      entityId: args.courseId,
      after: { acceptedAt },
    });
  },
});

export const cancelCourse = mutation({
  args: { courseId: v.id("courses"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) {
      throw new ConvexError("Course not found");
    }
    if (course.status === "completed" || course.status === "cancelled") {
      throw new ConvexError("This course is already finished");
    }
    await ctx.db.patch(args.courseId, { status: "cancelled" });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.cancel",
      entity: "courses",
      entityId: args.courseId,
      after: { reason: args.reason },
    });
  },
});

// Spec Sec7.7: "Link appointments to course items -- booking a session
// marks which procedure it fulfils." Deliberately just an association here
// (not a charge trigger) -- completing the item is its own explicit action
// below, so this doesn't have to reach into appointments.ts's existing,
// already-verified completion flow.
export const linkAppointmentToCourseItem = mutation({
  args: { appointmentId: v.id("appointments"), courseItemId: v.id("courseItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const [appointment, item] = await Promise.all([
      ctx.db.get(args.appointmentId),
      ctx.db.get(args.courseItemId),
    ]);
    if (appointment === null || item === null) {
      throw new ConvexError("Appointment or course item not found");
    }
    await ctx.db.patch(args.appointmentId, { courseItemId: args.courseItemId });
    await ctx.db.patch(args.courseItemId, { appointmentId: args.appointmentId });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.linkAppointment",
      entity: "courseItems",
      entityId: args.courseItemId,
      after: { appointmentId: args.appointmentId },
    });
  },
});

// Spec Sec7.7: "completing it creates the charge and advances progress."
// Mirrors billing/charges.ts's createChargeFromAppointment: price is a
// snapshot taken when the item was added to the course, never re-read from
// the service at completion time.
export const completeCourseItem = mutation({
  args: { courseItemId: v.id("courseItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get(args.courseItemId);
    if (item === null) {
      throw new ConvexError("Course item not found");
    }
    if (item.status !== "planned") {
      throw new ConvexError("This item isn't planned anymore");
    }
    const course = await ctx.db.get(item.courseId);
    if (course === null) {
      throw new ConvexError("Course not found");
    }
    if (course.status !== "accepted" && course.status !== "in_progress") {
      throw new ConvexError("Accept the course before completing items");
    }

    const amount = computeChargeAmount({ qty: 1, unitPrice: item.price, discount: 0 });
    const chargeId = await ctx.db.insert("charges", {
      patientId: course.patientId,
      source: "courseItem",
      sourceId: args.courseItemId,
      serviceId: item.serviceId,
      description: item.serviceName,
      qty: 1,
      unitPrice: item.price,
      discount: 0,
      vatRate: 0,
      amount,
      occurredAt: Date.now(),
      courseId: item.courseId,
    });
    await recomputeBalance(ctx, course.patientId);
    await ctx.db.patch(args.courseItemId, { status: "completed", chargeId });

    const siblings = await ctx.db
      .query("courseItems")
      .withIndex("by_course", (q) => q.eq("courseId", item.courseId))
      .collect();
    const stillPlanned = siblings.some(
      (s) => s._id !== args.courseItemId && s.status === "planned",
    );
    if (!stillPlanned) {
      await ctx.db.patch(item.courseId, { status: "completed" });
    } else if (course.status === "accepted") {
      await ctx.db.patch(item.courseId, { status: "in_progress" });
    }

    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.completeItem",
      entity: "courseItems",
      entityId: args.courseItemId,
      after: { chargeId, amount },
    });
    return chargeId;
  },
});

// Spec Sec7.5 + Sec7.7: "Proposal PDF -- branded, in the patient's
// language, clearly labelled as a quote, not an invoice." Reuses the same
// documents table/numbering as receipts (billing/documents.ts), just with
// kind: "quote" and lines built from course items instead of charges.
export const generateCourseProposal = mutation({
  args: { courseId: v.id("courses"), language: v.optional(LOCALE) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) {
      throw new ConvexError("Course not found");
    }
    const patient = await ctx.db.get(course.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }
    const items = await ctx.db
      .query("courseItems")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const lines = items.map((item) => ({
      description: item.serviceName,
      qty: 1,
      unitPrice: item.price,
      discount: 0,
      vatRate: 0,
      amount: item.price,
    }));
    if (course.discount > 0) {
      lines.push({
        description: "Course discount",
        qty: 1,
        unitPrice: -course.discount,
        discount: 0,
        vatRate: 0,
        amount: -course.discount,
      });
    }
    const totals = computeDocumentTotals(lines);

    const year = new Date().getFullYear();
    const number = await allocateDocumentNumber(ctx, "quote", year);

    const documentId = await ctx.db.insert("documents", {
      patientId: course.patientId,
      kind: "quote",
      number,
      issuedAt: Date.now(),
      issuedBy: user._id,
      lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      vatTotal: totals.vatTotal,
      total: totals.total,
      chargeIds: [],
      paymentIds: [],
      language: args.language ?? patient.language,
      fiscalStatus: "not_applicable",
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "course.generateProposal",
      entity: "documents",
      entityId: documentId,
      after: { courseId: args.courseId, number, total: totals.total },
    });
    return documentId;
  },
});
