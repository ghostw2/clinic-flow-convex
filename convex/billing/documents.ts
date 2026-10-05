import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { requireOwner, requireUser } from "../lib/auth_helpers";
import { writeAudit } from "../lib/audit";
import { allocateDocumentNumber } from "../lib/counters";
import { computeDocumentTotals } from "../lib/money";
import { DOCUMENT_KIND, LOCALE } from "../schema";

// Spec Sec7.5: the one Phase-1-exposed path through the generic "generate a
// document" dialog, scoped to kind: "receipt". Builds lines from the
// selected charges, allocates the transactional document number INSIDE
// this mutation (spec Sec7.9: "allocated transactionally... only on issue,
// never on draft"). A receipt stands for money actually received, so under
// Option A it still needs entering in the government portal -- fiscalStatus
// starts "pending_external" and the "to fiscalize" worklist (Sec7.9) picks
// it up until the operator reconciles it (Sec7.9.1).
export const generateReceipt = mutation({
  args: {
    patientId: v.id("patients"),
    chargeIds: v.array(v.id("charges")),
    paymentIds: v.array(v.id("payments")),
    payerName: v.optional(v.string()),
    payerNipt: v.optional(v.string()),
    payerAddress: v.optional(v.string()),
    language: v.optional(LOCALE),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const patient = await ctx.db.get(args.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }

    const charges = await Promise.all(args.chargeIds.map((id) => ctx.db.get(id)));
    const missingIndex = charges.findIndex((c) => c === null);
    if (missingIndex !== -1) {
      throw new ConvexError(`Charge ${args.chargeIds[missingIndex]} not found`);
    }

    const lines = charges.map((c) => ({
      description: c!.description,
      qty: c!.qty,
      unitPrice: c!.unitPrice,
      discount: c!.discount,
      vatRate: c!.vatRate,
      amount: c!.amount,
    }));
    const totals = computeDocumentTotals(lines);

    const year = new Date().getFullYear();
    const number = await allocateDocumentNumber(ctx, "receipt", year);

    const documentId = await ctx.db.insert("documents", {
      patientId: args.patientId,
      kind: "receipt",
      number,
      issuedAt: Date.now(),
      issuedBy: user._id,
      payerName: args.payerName,
      payerNipt: args.payerNipt,
      payerAddress: args.payerAddress,
      lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      vatTotal: totals.vatTotal,
      total: totals.total,
      chargeIds: args.chargeIds,
      paymentIds: args.paymentIds,
      language: args.language ?? patient.language,
      fiscalStatus: "pending_external",
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "document.generateReceipt",
      entity: "documents",
      entityId: documentId,
      after: { number, total: totals.total },
    });
    return documentId;
  },
});

// Spec Sec7.5: "One generation dialog... Pick a kind -- receipt, invoice,
// proforma, quote, statement. Pick what goes on it -- select charges,
// select payments..." The generic path generateReceipt was scoped to
// (kind fixed at "receipt"). A statement is naturally built from payments
// rather than charges (spec Sec7.8: "one document for everything paid
// this year" -> "generate statement -> select all payments"), so this
// accepts both chargeIds and paymentIds and uses whichever were actually
// selected to build line items -- never both at once, since mixing charge
// amounts and payment amounts into one subtotal would double-count money.
//
// fiscalStatus (spec Sec7.9): only receipt/invoice stand for money actually
// received, so only those need a trip through the "to fiscalize" worklist.
// A proforma/quote/statement is never itself fiscalized -- the receipt(s)
// behind it are -- so those kinds start "not_applicable".
export const generateDocument = mutation({
  args: {
    patientId: v.id("patients"),
    kind: DOCUMENT_KIND,
    chargeIds: v.array(v.id("charges")),
    paymentIds: v.array(v.id("payments")),
    payerName: v.optional(v.string()),
    payerNipt: v.optional(v.string()),
    payerAddress: v.optional(v.string()),
    language: v.optional(LOCALE),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const patient = await ctx.db.get(args.patientId);
    if (patient === null) {
      throw new ConvexError("Patient not found");
    }
    if (args.chargeIds.length === 0 && args.paymentIds.length === 0) {
      throw new ConvexError("Select at least one charge or payment");
    }

    const charges = await Promise.all(args.chargeIds.map((id) => ctx.db.get(id)));
    const missingCharge = charges.findIndex((c) => c === null);
    if (missingCharge !== -1) {
      throw new ConvexError(`Charge ${args.chargeIds[missingCharge]} not found`);
    }
    const payments = await Promise.all(args.paymentIds.map((id) => ctx.db.get(id)));
    const missingPayment = payments.findIndex((p) => p === null);
    if (missingPayment !== -1) {
      throw new ConvexError(`Payment ${args.paymentIds[missingPayment]} not found`);
    }

    const lines =
      charges.length > 0
        ? charges.map((c) => ({
            description: c!.description,
            qty: c!.qty,
            unitPrice: c!.unitPrice,
            discount: c!.discount,
            vatRate: c!.vatRate,
            amount: c!.amount,
          }))
        : payments.map((p) => ({
            description: `${p!.method}`,
            qty: 1,
            unitPrice: p!.amount,
            discount: 0,
            vatRate: 0,
            amount: p!.amount,
          }));
    const totals = computeDocumentTotals(lines);

    const year = new Date().getFullYear();
    const number = await allocateDocumentNumber(ctx, args.kind, year);

    const documentId = await ctx.db.insert("documents", {
      patientId: args.patientId,
      kind: args.kind,
      number,
      issuedAt: Date.now(),
      issuedBy: user._id,
      payerName: args.payerName,
      payerNipt: args.payerNipt,
      payerAddress: args.payerAddress,
      lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      vatTotal: totals.vatTotal,
      total: totals.total,
      chargeIds: args.chargeIds,
      paymentIds: args.paymentIds,
      language: args.language ?? patient.language,
      fiscalStatus:
        args.kind === "receipt" || args.kind === "invoice" ? "pending_external" : "not_applicable",
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "document.generate",
      entity: "documents",
      entityId: documentId,
      after: { kind: args.kind, number, total: totals.total },
    });
    return documentId;
  },
});

// Decision (spec Sec7.5, confirmed with the user before implementation):
// actual PDF byte generation is deferred to the frontend step, since
// there's no UI to preview or print it yet. This stub documents the
// intended shape for when that's built: fetch the document via
// ctx.runQuery, render it (a Node PDF library would need a "use node"
// directive at the top of a DIFFERENT file, since the mutations above
// can't run in the Node runtime), store the bytes with ctx.storage.store,
// then ctx.runMutation to patch `pdfStorageId` onto the document.
export const renderReceiptPdf = action({
  args: { documentId: v.id("documents") },
  handler: async () => {
    throw new ConvexError(
      "renderReceiptPdf is not implemented yet -- PDF rendering is deferred to the frontend step, see the comment above this function in convex/billing/documents.ts.",
    );
  },
});

// Spec Sec7.5: "Void and reissue -- voided documents are retained and
// marked, never deleted."
export const voidDocument = mutation({
  args: { documentId: v.id("documents"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (doc === null) {
      throw new ConvexError("Document not found");
    }
    await ctx.db.patch(args.documentId, { voidedAt: Date.now() });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "document.void",
      entity: "documents",
      entityId: args.documentId,
      before: doc,
      after: { reason: args.reason },
    });
  },
});

export const getDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.documentId);
  },
});

export const listDocumentsForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("documents")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

// Spec Sec7.9: "'To fiscalize' worklist -- a Finances tab listing today's
// payments that still need entering in the portal, each with a
// copy-friendly summary block (amount, date, service description,
// patient)." Modeled on documents rather than raw payments: every
// receipt/invoice already IS the fiscalizable unit, and fiscalStatus on
// the document is exactly "has this been reconciled with the portal yet."
export const listDocumentsToFiscalizeToday = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const pending = await ctx.db
      .query("documents")
      .withIndex("by_fiscal", (q) => q.eq("fiscalStatus", "pending_external"))
      .collect();
    const todays = pending.filter(
      (d) => d.issuedAt >= startOfDay.getTime() && d.voidedAt === undefined,
    );
    const patientIds = [...new Set(todays.map((d) => d.patientId))];
    const patients = await Promise.all(patientIds.map((id) => ctx.db.get(id)));
    const nameById = new Map(
      patients.filter((p) => p !== null).map((p) => [p._id, `${p.firstName} ${p.lastName}`]),
    );
    return todays
      .sort((a, b) => b.issuedAt - a.issuedAt)
      .map((d) => ({
        _id: d._id,
        number: d.number,
        kind: d.kind,
        issuedAt: d.issuedAt,
        total: d.total,
        patientName: nameById.get(d.patientId) ?? "—",
        description: d.lines.map((l) => l.description).join(", "),
      }));
  },
});

// Spec Sec7.9.1: "Three levels of capture, build them in this order: 1.
// Manual entry -- two fields and a file picker. Fifteen seconds. Always
// works. Ship this first." Levels 2 (QR-URL paste) and 3 (PDF regex) are
// deferred -- the QR's parameter names need verifying against a real
// Albanian fiscal invoice before coding them ("they're not worth guessing
// at"), which hasn't happened yet. This is the always-works path: the
// operator reads NIVF/NSLF off the portal's own PDF and types them in,
// then attaches that PDF -- never re-rendered in ClinicFlow's own
// template (spec: "store and display the portal's original PDF").
export const recordFiscalInvoice = mutation({
  args: {
    documentId: v.id("documents"),
    pdfStorageId: v.id("_storage"),
    nivf: v.string(),
    nslf: v.string(),
    fiscalNumber: v.string(),
    fiscalDate: v.number(),
    invoiceType: v.union(
      v.literal("cash"),
      v.literal("noncash"),
      v.literal("self"),
      v.literal("corrective"),
    ),
    totalOnFiscal: v.number(),
    verifyUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (doc === null) {
      throw new ConvexError("Document not found");
    }
    await ctx.db.patch(args.documentId, {
      fiscalStatus: "recorded",
      fiscalRecord: {
        pdfStorageId: args.pdfStorageId,
        nivf: args.nivf,
        nslf: args.nslf,
        fiscalNumber: args.fiscalNumber,
        fiscalDate: args.fiscalDate,
        verifyUrl: args.verifyUrl,
        invoiceType: args.invoiceType,
        totalOnFiscal: args.totalOnFiscal,
        recordedBy: user._id,
        recordedAt: Date.now(),
      },
    });
    await writeAudit(ctx, {
      actorId: user._id,
      action: "document.recordFiscalInvoice",
      entity: "documents",
      entityId: args.documentId,
      after: { nivf: args.nivf, nslf: args.nslf, totalOnFiscal: args.totalOnFiscal },
    });
  },
});

// Entitlement-checked storage URL access (spec Sec2/Sec15): "any function
// returning a storage URL must confirm the requesting user is entitled to
// that file." Phase 1 has a single clinic and two roles, so any
// authenticated staff member is entitled -- but structured so a future
// per-patient-access rule has exactly one place to change.
export const getDocumentUrl = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (doc === null || doc.pdfStorageId === undefined) {
      return null;
    }
    return await ctx.storage.getUrl(doc.pdfStorageId);
  },
});
