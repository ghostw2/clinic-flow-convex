import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const CLINIC_TYPES = v.union(
  v.literal("dental"),
  v.literal("aesthetic"),
  v.literal("physio"),
  v.literal("general"),
  v.literal("dermatology"),
  v.literal("gynecology"),
  v.literal("multi-specialty"),
);

export const LOCALE = v.union(v.literal("sq"), v.literal("en"));

export const APPOINTMENT_STATUS = v.union(
  v.literal("booked"),
  v.literal("confirmed"),
  v.literal("arrived"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("no_show"),
  v.literal("cancelled"),
);

export const PAYMENT_METHOD = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("transfer"),
  v.literal("other"),
);

export const DOCUMENT_KIND = v.union(
  v.literal("receipt"),
  v.literal("invoice"),
  v.literal("proforma"),
  v.literal("quote"),
  v.literal("statement"),
);

export const FISCAL_STATUS = v.union(
  v.literal("not_applicable"),
  v.literal("pending_external"),
  v.literal("recorded"),
);

const schema = defineSchema({
  // Convex Auth's own tables (users, sessions, accounts, tokens, verification
  // codes, rate limits). We redeclare `users` below to extend it in place
  // with ClinicFlow's profile fields, per Convex Auth's own documented
  // pattern (https://labs.convex.dev/auth/setup/schema) -- this keeps every
  // field Convex Auth needs plus its email/phone indexes, so nothing about
  // auth breaks, while avoiding a second `profiles` table and a join.
  ...authTables,

  users: defineTable({
    // --- fields Convex Auth's own `authTables.users` defines ---
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // --- ClinicFlow profile fields ---
    // Optional until onboarding/setRole assigns them: a freshly created
    // Password/Google user has neither until the first-owner bootstrap
    // callback in auth.ts runs, or the owner calls users.setRole.
    role: v.optional(v.union(v.literal("owner"), v.literal("assistant"))),
    isPractitioner: v.optional(v.boolean()),
    colour: v.optional(v.string()), // calendar column colour
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // Singleton clinic settings document. Singleton-ness is enforced in code
  // (clinic.ts:initClinic throws if a row already exists), not in the schema.
  clinic: defineTable({
    name: v.string(),
    logoId: v.optional(v.id("_storage")),
    address: v.string(),
    nipt: v.string(),
    phone: v.string(),
    timezone: v.string(),
    currency: v.string(),
    defaultLocale: LOCALE,
    clinicType: CLINIC_TYPES,
    workingHours: v.array(
      v.object({
        weekday: v.number(), // 0-6, 0 = Sunday
        openMin: v.number(), // minutes from midnight
        closeMin: v.number(),
        closed: v.boolean(),
      }),
    ),
    onboardingCompletedAt: v.optional(v.number()),
    // Spec Sec16.3: on-completion vs on-acceptance course charging is a
    // Phase 2 decision, but adding the field now is a one-line, zero-risk
    // addition (optional, unread until Phase 2 courses ship) versus a real
    // migration later -- so it's added now rather than deferred.
    chargeCourseOn: v.optional(
      v.union(v.literal("acceptance"), v.literal("completion")),
    ),
  }),

  services: defineTable({
    name: v.string(),
    durationMin: v.number(),
    price: v.number(),
    colour: v.string(),
    vatRate: v.number(), // default 0 -- medical care is VAT-exempt (Law 92/2014)
    vatExemptReason: v.optional(v.string()),
    active: v.boolean(),
  }).index("by_active", ["active"]),

  patients: defineTable({
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
    // Denormalized, normalized (diacritics stripped) blob built in the
    // mutation on every create/update -- see lib/normalize.ts.
    searchBlob: v.string(),
    // Denormalized running balance, recomputed transactionally in the same
    // mutation that writes a charge or payment -- see billing/balance.ts.
    balance: v.number(),
    archived: v.boolean(),
    // Denormalized from the patient's own appointments (step 3's patients
    // list needs "last visit"/"last service" per row without an N+1 query
    // across hundreds of patients). Written by appointments.ts's
    // transitionStatus in the same mutation that completes an appointment --
    // same "no joins" rationale as appointments.patientName etc.
    lastVisitAt: v.optional(v.number()),
    lastServiceName: v.optional(v.string()),
    lastServiceColour: v.optional(v.string()),
    // Same reasoning: the list's "N no-show" badge needs a count without
    // scanning every patient's appointments. Incremented by
    // transitionStatus when an appointment moves to "no_show".
    noShowCount: v.optional(v.number()),
  })
    .index("by_name", ["lastName"])
    .index("by_phone", ["phone"]) // duplicate detection
    .index("by_nid", ["nid"]) // duplicate detection
    // Backs the patients list: filter by archived, ordered by last visit.
    .index("by_archived_lastVisit", ["archived", "lastVisitAt"])
    .searchIndex("search_patients", { searchField: "searchBlob" }),

  appointments: defineTable({
    patientId: v.id("patients"),
    practitionerId: v.id("users"),
    serviceId: v.id("services"),
    start: v.number(),
    end: v.number(),
    status: APPOINTMENT_STATUS,
    notes: v.optional(v.string()),
    // Spec Sec7.7: "Link appointments to course items -- booking a session
    // marks which procedure it fulfils; completing it creates the charge
    // and advances progress."
    courseItemId: v.optional(v.id("courseItems")),
    // Denormalized per the "no joins" rule (Sec15): the calendar view needs
    // these without a lookup, and they're kept in sync by whichever
    // mutation changes the source patient/user/service row.
    patientName: v.string(),
    practitionerName: v.string(),
    serviceName: v.string(),
    serviceColour: v.string(),
    // Set once appointments.updateAppointmentStatus completes this
    // appointment and creates the corresponding charge.
    chargeId: v.optional(v.id("charges")),
  })
    .index("by_start", ["start"])
    .index("by_patient", ["patientId"])
    // Backs both the day/week-by-practitioner view and the double-booking
    // overlap check, which must run inside the same index range as the
    // mutation that creates/moves an appointment.
    .index("by_practitioner_start", ["practitionerId", "start"]),

  // Spec Sec7.7 + Sec16.1: treatment courses. Dental confirmed as the
  // beachhead, so courseItems carries a structured toothRef (tooth number +
  // surfaces) rather than a free-text string. `discount` is course-level,
  // applied across all items' total at proposal/accept time.
  courses: defineTable({
    patientId: v.id("patients"),
    status: v.union(
      v.literal("draft"),
      v.literal("proposed"),
      v.literal("accepted"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    discount: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
  }).index("by_patient", ["patientId"]),

  courseItems: defineTable({
    courseId: v.id("courses"),
    serviceId: v.id("services"),
    serviceName: v.string(), // snapshot, same price-never-retroactive rule as charges
    price: v.number(),
    toothRef: v.optional(
      v.object({
        tooth: v.number(), // FDI notation, lib/tooth-chart.ts
        surfaces: v.optional(v.array(v.string())),
      }),
    ),
    status: v.union(v.literal("planned"), v.literal("completed"), v.literal("cancelled")),
    appointmentId: v.optional(v.id("appointments")),
    chargeId: v.optional(v.id("charges")),
  }).index("by_course", ["courseId"]),

  // --- Billing: the elastic ledger (spec Sec7). Charges, payments and
  // documents ship in FINAL shape in Phase 1 even though only one path
  // through them (complete -> charge -> pay-in-full-cash -> receipt) is
  // exposed, because reshaping the financial model later, with live
  // patient money in the system, is expensive in a way that adding a
  // column to an empty table is not. ---

  charges: defineTable({
    patientId: v.id("patients"),
    source: v.union(
      v.literal("appointment"),
      v.literal("courseItem"),
      v.literal("product"),
      v.literal("manual"),
    ),
    sourceId: v.optional(v.string()), // appointmentId | courseItemId | ...
    serviceId: v.optional(v.id("services")),
    description: v.string(),
    qty: v.number(),
    unitPrice: v.number(), // snapshot at time of charge -- never retroactive
    discount: v.number(),
    vatRate: v.number(),
    vatExemptReason: v.optional(v.string()),
    amount: v.number(), // qty * unitPrice - discount
    occurredAt: v.number(),
    courseId: v.optional(v.id("courses")),
    voidedAt: v.optional(v.number()),
    voidReason: v.optional(v.string()),
  })
    .index("by_patient", ["patientId"])
    .index("by_occurred", ["occurredAt"])
    .index("by_course", ["courseId"]),

  payments: defineTable({
    patientId: v.id("patients"),
    amount: v.number(), // negative for refunds
    method: PAYMENT_METHOD,
    receivedAt: v.number(),
    receivedBy: v.id("users"),
    note: v.optional(v.string()),
    // FIFO-computed in Phase 1; manual override is a later phase, but the
    // shape already supports it.
    allocations: v.optional(
      v.array(v.object({ chargeId: v.id("charges"), amount: v.number() })),
    ),
    planId: v.optional(v.id("paymentPlans")),
    refundOfId: v.optional(v.id("payments")),
  })
    .index("by_received", ["receivedAt"])
    .index("by_patient", ["patientId"]),

  documents: defineTable({
    patientId: v.id("patients"),
    kind: DOCUMENT_KIND,
    number: v.string(), // e.g. "RC-2026-0042" -- allocated only on issue
    issuedAt: v.number(),
    issuedBy: v.id("users"),
    payerName: v.optional(v.string()),
    payerNipt: v.optional(v.string()),
    payerAddress: v.optional(v.string()),
    lines: v.array(
      v.object({
        description: v.string(),
        qty: v.number(),
        unitPrice: v.number(),
        discount: v.number(),
        vatRate: v.number(),
        amount: v.number(),
      }),
    ),
    subtotal: v.number(),
    discountTotal: v.number(),
    vatTotal: v.number(),
    total: v.number(),
    chargeIds: v.array(v.id("charges")),
    paymentIds: v.array(v.id("payments")),
    pdfStorageId: v.optional(v.id("_storage")),
    language: LOCALE,
    voidedAt: v.optional(v.number()),
    replacedByDocumentId: v.optional(v.id("documents")),
    fiscalStatus: FISCAL_STATUS,
    // Populated later (Phase 3) when the operator brings the fiscal invoice
    // back from the government portal. Present now in full shape so it
    // never needs a reshape once that flow ships.
    fiscalRecord: v.optional(
      v.object({
        pdfStorageId: v.id("_storage"),
        nivf: v.string(), // FIC -- returned by the CIS
        nslf: v.string(), // IIC -- generated by the issuing software
        fiscalNumber: v.string(),
        fiscalDate: v.number(),
        verifyUrl: v.optional(v.string()),
        invoiceType: v.union(
          v.literal("cash"),
          v.literal("noncash"),
          v.literal("self"),
          v.literal("corrective"),
        ),
        totalOnFiscal: v.number(),
        recordedBy: v.id("users"),
        recordedAt: v.number(),
      }),
    ),
  })
    .index("by_issued", ["issuedAt"])
    .index("by_patient", ["patientId"])
    .index("by_fiscal", ["fiscalStatus"]),

  // Transactional per-kind-per-year counters backing document numbering.
  // Read-modify-write happens inside the same mutation that issues the
  // document, so there is no race between two receipts in the same year.
  documentCounters: defineTable({
    key: v.string(), // e.g. "RC-2026"
    lastNumber: v.number(),
  }).index("by_key", ["key"]),

  // Access + change audit trail (spec Sec11). Write path lives in
  // lib/audit.ts's writeAudit helper, called from inside other mutations --
  // never exposed as a directly callable public mutation.
  auditLogs: defineTable({
    actorId: v.id("users"),
    action: v.string(), // e.g. "patient.create", "appointment.complete"
    entity: v.string(), // "patients" | "appointments" | "charges" | ...
    entityId: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    occurredAt: v.number(),
  })
    .index("by_entity", ["entity", "entityId"])
    .index("by_occurred", ["occurredAt"]),

  // File metadata backing the entitlement-checked storage-URL pattern
  // (Sec2/Sec15). No upload UI exists yet in Phase 1, but the rule -- never
  // return a Convex storage URL without checking entitlement first -- is
  // established here now rather than retrofitted later.
  files: defineTable({
    patientId: v.id("patients"),
    storageId: v.id("_storage"),
    category: v.string(), // "xray" | "referral" | "scan" | "consent" | ...
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  }).index("by_patient", ["patientId"]),

  // Spec Sec8: "Note templates from field primitives... Clinic-owned,
  // clonable." Seeded by clinic type (lib/constants.ts), editable later --
  // the template *builder* UI is a later step, but the data model ships in
  // final shape now so clinicalNotes.values never has to be reshaped.
  noteTemplates: defineTable({
    name: v.string(),
    fields: v.array(
      v.object({
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
      }),
    ),
    active: v.boolean(),
  }).index("by_active", ["active"]),

  // Spec Sec8: note signing locks the note; "amend-after-sign -- amendments
  // append and appear in the audit trail, never overwrite" (legally
  // required). `values`/`templateName`/`authorName` are snapshots at
  // creation time -- editing the template or the author's name later must
  // never retroactively change a past note, same rule as charges' price
  // snapshot (spec Sec7.3).
  clinicalNotes: defineTable({
    patientId: v.id("patients"),
    templateId: v.id("noteTemplates"),
    templateName: v.string(),
    authorId: v.id("users"),
    authorName: v.string(),
    appointmentId: v.optional(v.id("appointments")),
    values: v.array(v.object({ fieldId: v.string(), value: v.any() })),
    status: v.union(v.literal("draft"), v.literal("signed")),
    signedAt: v.optional(v.number()),
    createdAt: v.number(),
    amendments: v.optional(
      v.array(
        v.object({
          text: v.string(),
          authorId: v.id("users"),
          authorName: v.string(),
          createdAt: v.number(),
        }),
      ),
    ),
  }).index("by_patient", ["patientId", "createdAt"]),

  // Spec Sec7.6: "A payment plan is a projection, not a commitment. It
  // schedules expected payments. It never holds money and it can be
  // edited, regenerated or deleted without touching the ledger." Only
  // charges/payments (above) are financial truth; these two tables are a
  // schedule/view layered on top.
  paymentPlans: defineTable({
    patientId: v.id("patients"),
    courseId: v.optional(v.id("courses")),
    basisAmount: v.number(), // the balance the plan was built against
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    cancelledAt: v.optional(v.number()),
  }).index("by_patient", ["patientId"]),

  // Spec Sec7.6: "Payments apply to the balance, not to specific
  // installments. Installments are marked paid as the balance drops past
  // them." Status here is a synced projection, recomputed whenever a
  // payment/refund lands for the plan's patient (billing/paymentPlans.ts),
  // not something a client ever sets directly except via hand-edit.
  installments: defineTable({
    planId: v.id("paymentPlans"),
    seq: v.number(),
    dueDate: v.number(),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
    ),
  })
    .index("by_plan", ["planId"])
    .index("by_due", ["dueDate"]), // the nightly overdue sweep
});

export default schema;
