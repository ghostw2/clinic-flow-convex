@AGENTS.md

# ClinicFlow — V1 Feature List

**Consolidated master document.** Supersedes the previous feature list and the tenancy/financials supplement.

Stack: Convex backend, Next.js + shadcn/ui, Clerk or Convex Auth.
Target user: **one person running a small clinic**, who is simultaneously the doctor, the receptionist and the accountant.

Two decisions now locked in:

- **Fiscalization: Option A for the pilot.** ClinicFlow produces internal documents. The clinic fiscalizes through the free government portal or its existing fiscal program. Fields and interfaces are in place for a later provider integration.
- **Billing is elastic.** Any service can be paid in full, in installments, or switched between the two at any time, without the app treating any of it as a special case.

> Not legal or tax advice. Confirm the document-labelling and advance-payment questions in §7.9 with an Albanian accountant.

---

## 1. Positioning

**Selling points:**

1. Elastic billing — pay at once, in installments, or change your mind mid-course
2. Treatment courses with payment plans, which no competitor models properly
3. Albanian-first (Albanian + English at launch, i18n infrastructure for 5 more)

**Non-goals — write these down so scope creep can't argue:**

No insurance claims. No inpatient / beds / wards. No LIS or PACS. No patient-acquisition marketplace. No native mobile app. No fiscalization integration in V1. No Stripe subscriptions in V1.

---

## 2. Single-tenant foundation

Tenancy is dropped. ClinicFlow serves one clinic. `clinicId` columns, the `memberships` table, the `clinicQuery`/`clinicMutation` wrapper and the ESLint rule are all gone. Indexes start with the real key — `patientId`, `occurredAt`, `dueDate`.

**Clinic settings live in a singleton document** (`clinic`) holding name, logo, address, NIPT, phone, timezone, currency, default language and working hours.

**One thing survives from the tenancy layer: the file storage ownership check.** Convex storage URLs are unguessable but not access-controlled, so every function returning one must confirm the requesting user is entitled to that file. This was never really about tenancy — it's about a patient's x-ray not being fetchable by anyone who obtains the URL — so it stays.

**Cut:** subdomains, per-tenant theming, super-admin console, feature flags, multi-location, Stripe billing.

> **One honest note, stated once.** Adding a second clinic later means a migration across every table, every index and every query, with live patient data in the system. That's real work — maybe a week at this app's size — but it isn't existential, and it's a fair trade for shipping faster now.
>
> What matters is which version of single-tenant you're building. **One Convex deployment per clinic** is a legitimate architecture: clinic two is a new deployment, isolation is perfect by construction, and the migration only arrives when you want a shared control plane. **One shared deployment with no `clinicId`** is the trap — clinic two is impossible without the migration first. Decide which one you're doing before you have a second clinic asking, not after.

---

## 2b. Phase-1 schema

```ts
clinic:       { name, logoId?, address, nipt, phone, timezone,
                currency, defaultLocale, workingHours }        // singleton

users:        { email, name, role: "owner" | "assistant", isPractitioner }

patients:     { firstName, lastName, dob?, gender?, nid?, phone, email?,
                address?, emergencyContact?, referralSource?, tags?, notes?,
                language, searchBlob, balance, archived }
              .index("by_name", ["lastName"])
              .index("by_phone", ["phone"])                    // duplicate detection
              .index("by_nid", ["nid"])
              .searchIndex("search_patients", { searchField: "searchBlob" })

services:     { name, durationMin, price, colour, vatRate, vatExemptReason?, active }

appointments: { patientId, practitionerId, serviceId, start, end,
                status, notes?, courseItemId? }
              .index("by_start", ["start"])
              .index("by_patient", ["patientId"])
```

Financial tables in §7.2. `balance` is denormalized onto the patient and recomputed in the same mutation that writes a charge or payment — Convex mutations are transactional, so it can't drift.

---

## 3. Auth, roles, team

- Email + password, and **Google sign-in** (iPacienti does this; it removes a whole friction step)
- **Two roles:** `owner` (everything) and `assistant` (everything except opening clinical notes). The receptionist-can't-read-notes line is the one that matters under Law 124/2024; the rest of the role matrix can wait.
- `isPractitioner` flag on membership — only practitioners get a calendar column
- Owner creates the second user directly. No invitation flow in V1.
- **Cut:** granular overrides, accountant role, 2FA, session management, invitations

---

## 4. Onboarding wizard

Highest-leverage screen in the app. Pattern from Noterro and iPacienti.

1. **Clinic type** — dental / aesthetic / physio / general / dermatology / gynecology / multi-specialty. Seeds services, note templates and terminology.
2. **Clinic details** — name, logo, address, NIPT, phone, timezone, currency, default language
3. **Services** — pre-seeded from clinic type with prices and durations, so they *edit* rather than create
4. **Working hours**
5. **Done** → dashboard with a checklist of what's still empty

Skippable at every step. A solo operator should be booking their first appointment within four minutes.

**Cut from the original wizard:** locations, staff invitations, clinic size (that fed the Stripe plan suggestion, which no longer exists), booking policies (no online booking in V1).

---

## 5. Patients

- Registry with **full-text search** across name, phone and personal ID via a denormalized `searchBlob` field maintained in the mutation. Patient lookup is the single most-used action in the app.
- **Fields:** name, DOB, gender, personal ID (NID), phone, email, address, emergency contact, referral source, tags, internal notes, preferred language
- **Duplicate detection** on phone / NID at creation
- **Record page tabs:** Overview · Appointments · Clinical · Courses · Billing · Files · Activity
- **Timeline** — appointments, notes, charges, payments, documents, messages in one reverse-chronological stream
- **Running balance shown at the top of every patient page.** With elastic billing this is the number that matters, and it should never require a click to see.
- **File uploads** — x-rays, referrals, scans, consent PDFs. Convex file storage, category tag per file.
- **Archive** (soft-hide, retains for legal retention). Never hard-delete outside an erasure request.
- **Cut:** merge duplicates, family linking, before/after photos

---

## 6. Scheduling

Used 200 times a day. Has to be excellent.

- **Views:** day (default), week, agenda list for mobile
- **Column per practitioner**, filterable — Jane's model
- **Colour by service or status** — booked / confirmed / arrived / in progress / completed / no-show / cancelled
- **Drag to move, drag edge to resize**, with optimistic updates (Convex rolls back on failure)
- **Double-booking prevention enforced in the mutation.** Convex mutations are transactional, so this is genuinely airtight rather than best-effort.
- **Real-time sync** via Convex subscriptions — no polling. A visible quality gap against every local competitor, essentially free on this stack.
- **Working hours and availability** per practitioner, per weekday
- **Time off / holidays / breaks** as booking-blocking entries
- **Check-in flow** — arrived → in progress → completed
- **Recurring appointments**
- **Walk-in button** — creates an appointment starting now, for an unbooked patient, in one click. Critical for a one-person clinic.
- **Cut:** rooms and equipment as resources, waitlist, group classes, online booking

---

## 7. Billing — the elastic ledger

The centre of the product. Read §7.1 before anything else; the rest follows from it.

### 7.1 The principle

**Charges and payments are the truth. Documents are generated views over them.**

Most clinic software makes the invoice the primary object: you create an invoice, then you pay it, and everything else is an exception. That model is exactly what makes installments painful — it can't answer "the patient wants to pay half of two different treatments now and the rest next month" without contortions.

ClinicFlow inverts it:

- A **charge** records that the patient owes something (a completed service, a course item, a product)
- A **payment** records that money arrived
- The **balance** is the difference
- A **document** — receipt, invoice, proforma, quote, statement — is generated *on demand* from any selection of charges or payments, and can be regenerated, voided or reissued freely because it doesn't own any money

That's the elasticity. Paying in full and paying in installments stop being two different code paths; they're two patterns of payment against the same ledger.

**A payment plan is a projection, not a commitment.** It schedules *expected* payments. It never holds money and it can be edited, regenerated or deleted without touching the ledger.

### 7.2 Data model

```ts
charges: {
  patientId,
  source: "appointment" | "courseItem" | "product" | "manual",
  sourceId?,                       // appointmentId | courseItemId | ...
  serviceId?, description,
  qty, unitPrice, discount, vatRate, vatExemptReason?,
  amount,                          // qty * unitPrice - discount
  occurredAt, courseId?,
  voidedAt?, voidReason?,
}
.index("by_patient", ["patientId"])
.index("by_occurred", ["occurredAt"])
.index("by_course", ["courseId"])

payments: {
  patientId,
  amount, method: "cash" | "card" | "transfer" | "other",
  receivedAt, receivedBy, note?,
  allocations?: Array<{ chargeId, amount }>,   // phase 3; auto FIFO by default
  planId?, refundOfId?,
}
.index("by_received", ["receivedAt"])
.index("by_patient", ["patientId"])

documents: {
  patientId,
  kind: "receipt" | "invoice" | "proforma" | "quote" | "statement",
  number, issuedAt, issuedBy,
  payerName?, payerNipt?, payerAddress?,        // third-party payer support
  lines: Array<{ description, qty, unitPrice, discount, vatRate, amount }>,
  subtotal, discountTotal, vatTotal, total,
  chargeIds: Id[], paymentIds: Id[],            // provenance
  pdfStorageId?, language,
  voidedAt?, replacedByDocumentId?,
  fiscalStatus: "not_applicable" | "pending_external" | "recorded",

  // populated when the operator brings the fiscal invoice back from the portal
  fiscalRecord?: {
    pdfStorageId,                 // the portal's PDF, stored as-is
    nivf,                         // FIC — returned by the CIS
    nslf,                         // IIC — generated by the issuing software
    fiscalNumber,                 // e.g. "12/2026/xxxxxxxxxx"
    fiscalDate,
    verifyUrl?,                   // what the QR encodes
    invoiceType: "cash" | "noncash" | "self" | "corrective",
    totalOnFiscal,                // for mismatch detection
    recordedBy, recordedAt,
  },
}
.index("by_issued", ["issuedAt"])
.index("by_patient", ["patientId"])
.index("by_fiscal", ["fiscalStatus"])

paymentPlans: {                                  // phase 3
  patientId, courseId?,
  basisAmount,                                   // what the plan was built against
  status: "active" | "completed" | "cancelled",
  createdAt, cancelledAt?,
}
installments: {
  planId, seq, dueDate, amount,
  status: "pending" | "paid" | "overdue" | "cancelled",
}
.index("by_due", ["dueDate"])                    // the reminder sweep
.index("by_plan", ["planId"])
```

**These three tables ship in final shape in Phase 1**, even though only one path through them is exposed. Adding a column to a table with a hundred rows is trivial; reshaping the financial model after a clinic has six months of money in it is not.

**Denormalize `balance` onto the patient document**, recomputed in the same mutation that writes a charge or payment. Convex mutations are transactional, so this can't drift.

### 7.3 Charges

- Created automatically when an appointment is marked **completed** — from the service on the appointment, at the service's current price
- Created in bulk when a **treatment course is accepted** — one charge per course item, or one per item as it's completed (clinic setting; default is on completion, so the balance tracks work actually done)
- Created manually for anything else
- **Editable and voidable** until covered by a payment allocation; voided charges stay visible with a reason
- Price on the charge is a **snapshot**. Changing a service's price later must never retroactively alter someone's balance.

### 7.4 Payments

- **Record payment** from anywhere: the appointment panel, the patient page, the course view, the Finances screen
- Amount defaults intelligently — the current appointment's charge, or the next installment due, or the full balance, depending on where you're standing
- Methods: cash, card, transfer, other
- **Auto-allocation FIFO** against open charges by default; manual allocation available when it matters (third-party payer, disputed item)
- **Overpayment becomes account credit**, applied to the next charge automatically
- **Refunds** as negative payments linked to the original

### 7.5 Documents on demand

One generation dialog, reachable from the patient page, the appointment panel, and the Finances screen:

1. Pick a **kind** — receipt, invoice, proforma, quote, statement
2. Pick **what goes on it** — select charges, select payments, or "everything outstanding", or "everything this year"
3. Pick the **payer** — the patient, or a third party (employer, family member, insurer) with their own name and NIPT
4. Pick the **language** — defaults to the patient's
5. Generate → PDF, print, email, or save

Because documents don't own money, all of this is safe. Regenerating a document in German for a dental-tourism patient is not a financial event.

- **Void and reissue** — voided documents are retained and marked, never deleted
- Every document records the charge and payment IDs it was built from, so you can always answer "what is this document actually covering"

### 7.6 Payment plans

- **Create a plan from any balance** — not just from a course. "This patient owes 84,000; split it over 6 months."
- Generator: deposit amount, number of installments, frequency (monthly / biweekly / custom), start date. Hand-edit any individual amount or date afterwards.
- **Payments apply to the balance, not to specific installments.** Installments are marked paid as the balance drops past them. This is what makes early settlement and partial overpayment work without special handling.
- **Actions available at any time:**
  - **Settle balance** — take one payment for everything remaining; plan closes automatically
  - **Convert to plan** — patient who was paying per visit wants to spread the rest
  - **Recalculate** — the course grew or shrank; regenerate remaining installments from the new balance
  - **Cancel plan** — the ledger is untouched; only the schedule disappears
- Nightly cron flips `pending` → `overdue` and surfaces on the Outstanding tab
- Reminders fire via `ctx.scheduler`, N days before each due date

### 7.7 Treatment courses

- **Course builder** — pick services, adjust prices, apply a course-level discount, live total
- **Course items** carry `toothRef` for dental (see §16 open decisions)
- **Statuses:** draft → proposed → accepted → in progress → completed / cancelled
- **Proposal PDF** — branded, in the patient's language, clearly labelled as a quote (`Ofertë` / `Plan trajtimi`), not an invoice
- **Link appointments to course items** — booking a session marks which procedure it fulfils; completing it creates the charge and advances progress
- **Progress display** — procedures done vs planned, amount paid vs total, both on the course view and the patient overview
- **Adding a procedure mid-course** creates a new charge and offers to recalculate the plan
- **Cut:** course templates, memberships, packages

### 7.8 Scenario walkthrough

The test of the model. All of these use the same three primitives.

| Scenario | What happens |
| --- | --- |
| Single visit, pays cash now | Complete appointment → charge → "Paid in full, cash" → receipt |
| Single visit, pays later | Complete appointment → charge. Balance outstanding. Document generated whenever they ask. |
| Course accepted, pays everything upfront | Accept course → charges. One payment for the total. One receipt. No plan needed. |
| Course accepted, 8 monthly installments | Accept course → charges → create plan. Each payment → receipt. Reminders automatic. |
| Halfway through, wants to clear the rest | **Settle balance** → one payment → plan closes |
| Was paying per visit, now wants a plan | **Convert to plan** from current balance |
| Pays 30,000 when 20,000 was due | Surplus reduces the balance; the next installment is marked paid early |
| Extra procedure added mid-course | New charge → balance rises → **Recalculate** remaining installments |
| Employer wants a document for three visits | Generate invoice → select those three charges → payer = employer with their NIPT |
| Patient wants one document for everything paid this year | Generate statement → select all payments in the range |

No branching logic. No "installment mode" flag on the patient.

### 7.9 Fiscalization under Option A

ClinicFlow does **not** submit anything to the CIS in V1. The clinic fiscalizes through the free government portal (`efiskalizimi-app.tatime.gov.al`) or their existing fiscal program.

What this requires from the app:

- **Documents are clearly non-fiscal.** Every generated PDF carries a footer stating it is not a fiscal invoice — get the exact Albanian wording from an accountant. Do not let a clinic hand this to a patient believing it's a fatura fiskale.
- **Distinct numbering shape.** Use `RC-2026-0042`, `FT-2026-0007` — deliberately *unlike* the fiscal `12/2026/TCRcode` format, so the two are never confused. Sequential per clinic, per year, per kind, allocated transactionally in a counter document, **only on issue, never on draft**.
- **"To fiscalize" worklist** — a Finances tab listing today's payments that still need entering in the portal, each with a copy-friendly summary block (amount, date, service description, patient). This turns the double entry from an invisible burden into a five-minute end-of-day checklist.
- **Daily CSV export** shaped for portal entry.

### 7.9.1 Bringing the fiscal invoice back — closing the loop

The operator generates a proforma during the visit, fiscalizes in the portal, then returns the resulting fiscal invoice to ClinicFlow. This is what makes Option A a workflow rather than an apology.

**Legally this is just record-keeping.** You are storing a copy of a document the clinic already issued through certified means. You submit nothing, so no certification obligation attaches to you. It also serves a real requirement: **Albania requires issuers to retain original electronic invoices for at least five years**, so "every fiscal invoice attached to the patient record, searchable" is a compliance feature rather than tidiness.

**Three levels of capture, build them in this order:**

1. **Manual entry** — two fields and a file picker. Fifteen seconds. Always works. Ship this first.
2. **Paste the verification URL** — the QR on every Albanian fiscal invoice encodes a link to the tax authority's verification page, carrying the NIVF, NSLF, issuer NIPT, datetime and total as query parameters. The operator scans the QR with their phone camera and pastes; you parse and fill everything in one action. **Verify the actual parameter names against a real invoice before coding** — they're not worth guessing at.
3. **PDF parsing** — best-effort regex for NIVF and NSLF, presented for confirmation rather than trusted. Portal layouts change.

**Bulk reconcile screen — the flow that actually matters.** Nobody does this one at a time. The realistic pattern is eight invoices in the portal at end of day, then back to ClinicFlow. So: drop in multiple PDFs, auto-match each to a document by amount and date, show a review table with confident matches pre-linked and ambiguous ones needing one click. Unmatched files stay flagged.

Worth investigating first: the SelfCare portal may support exporting the day's invoices as a list or XML. If it does, one upload reconciles everything and PDF matching becomes the fallback.

**Two things not to do:**

- **Never re-render the fiscal invoice in your own template.** Store and display the portal's original PDF. Regenerating it with your styling produces a document that looks fiscal but isn't the artifact that was actually submitted.
- **Flag amount mismatches, don't block on them.** If the fiscal total differs from your document total, warn. The usual cause is the operator combining two payments into one fiscal invoice — legitimate, but it should be visible rather than silently reconciled.

**Terminology trap.** Sources contradict each other and it will cost you an afternoon. Developer-facing integration documentation is consistent: **NSLF = IIC**, the issuer security code generated by the issuing software; **NIVF = FIC**, the fiscal invoice code returned by the CIS after validation. Several tax-guidance articles swap these. Trust the integration docs.

**Side benefit:** clinics that reconcile give you real invoice-volume data, which is exactly the number that tells you when a Phase 1 provider integration is worth paying for.

**What to build now for Phase 1:** the `fiscal` sub-object on documents (already in the schema above) and a `FiscalProvider` interface with a no-op implementation. Nothing else. When you integrate a certified Albanian provider later, you swap one file and add a scheduler-driven submit action.

```ts
export interface FiscalProvider {
  registerInvoice(input: FiscalInvoiceInput): Promise<{ nivf, nslf, qrUrl, registeredAt }>;
  cancelInvoice(nivf: string, reason: string): Promise<void>;
  registerCashDeposit(amount: number, type: "in" | "out"): Promise<void>;
}
export const noopProvider: FiscalProvider = { /* throws NotConfiguredError */ };
```

### 7.10 VAT

Medical and dental care by licensed practitioners is **VAT-exempt** in Albania under Law 92/2014. So:

- `vatRate` lives **per service**, defaulting to 0 with an exemption reason — not as a global constant. Clinics sell the occasional non-exempt item (retail products, some cosmetic work), and there's live policy discussion about reviewing the health exemption. A per-service field makes either case a data change.
- No input-VAT-recovery reporting. Exempt is not zero-rated; the clinic can't reclaim.

---

## 8. Clinical documentation

- **Chart per patient** with expandable history preview
- **Note templates from field primitives** — text, textarea, number, checkbox, radio, dropdown, date, signature, file, body/dental chart. Clinic-owned, clonable.
- **Seeded template library by clinic type** — dental exam, physio SOAP, aesthetic consultation, general consultation. This is what makes the app feel finished on day one.
- **Note signing** — clinician e-signature locks the note
- **Amend-after-sign** — amendments append and appear in the audit trail, never overwrite. Legally required.
- **Odontogram** — in V1 *if* dental is the beachhead (see §16)
- **Cut:** ICD-10 coding, consent e-signature, prescriptions, lab orders, outcome measures, AI scribe

---

## 9. Communications

- **Appointment reminders** — email + SMS, timing configurable
- **Confirmations, reschedules, cancellations** — automatic
- **Installment due reminders** — via `ctx.scheduler`, N days before
- **Manual message** from the patient record, logged to the timeline
- **Templates with variables** (`{patient_name}`, `{appointment_time}`, `{amount_due}`, `{balance}`) **per language**
- Delivery status and failed-send visibility
- **Cut:** WhatsApp, recalls, campaigns, review requests

---

## 10. Finances screen

Three tabs. A solo operator doesn't need more.

**Today** — money in by method, charges created, documents issued, **the "to fiscalize" worklist**, and the **bulk reconcile** entry point for dropping in fiscal invoices at end of day (§7.9.1)

**Outstanding** — unpaid balances and overdue installments, aged, sorted by amount. For a one-person clinic this is the single highest-value screen in the product, because nobody else is chasing this money.

**Reports** — revenue by period / service / payment method, new vs returning patients, no-show rate, course acceptance rate, installment collection rate. Date range picker, CSV export for the accountant.

**Dashboard** (separate, the landing screen) — today's appointments, arrivals pending, today's takings, total outstanding, overdue installments.

**Cut:** expenses, products/retail, practitioner commissions, productivity reports (there's one practitioner), marketing attribution.

---

## 11. Compliance & audit

Law 124/2024 is GDPR-aligned and in force. Health data is special-category. Keep this in V1 — it's cheap now and miserable to retrofit.

- **Access audit log** — who opened which patient record, when
- **Change audit** — who changed what, before/after, on clinical and financial records
- **Consent capture** — recorded, versioned, revocable
- **Data subject rights as features** — export (JSON/PDF), rectify, erase. Erasure respects financial retention, so implement as pseudonymization of the clinical record rather than a hard delete.
- Encryption in transit and at rest; check Convex's available regions and be ready to answer the data-residency question in sales calls — Proklinika markets GDPR features locally, so clinics are primed to ask
- Retention policy per data type
- **Cut:** breach runbook tooling, DPIA automation, nightly backup UI

---

## 12. Internationalization

- **Launch with Albanian + English.** Infrastructure supports adding Italian, German, Greek, Macedonian, Serbian as translation files.
- **Three separate surfaces, don't conflate them:**
  1. UI strings — `next-intl`, routed `/[locale]/`
  2. Clinic-authored content (service names, templates) — data with per-language variants
  3. **Patient-facing output** (documents, emails, SMS) — renders in the **patient's** language, not the operator's
- Locale-aware dates, numbers, currency
- Albanian diacritics (ë, ç) normalized on the search index

The reason to do i18n properly on day one isn't the seven languages — it's that retrofitting it means touching every string in the app.

---

## 13. Settings

- **Our Clinic** — details, branding, NIPT, working hours
- **Appointments** — services, durations, prices, colours, reminders
- **Patients** — custom fields, tags, referral sources
- **Finances** — currency, VAT defaults, document numbering, payment methods, document footer text
- **Communication** — templates per language, channels, sender identity
- **Team** — the two users
- **Clinical** — note templates
- **Data** — export, audit log

---

## 14. Designing for one person

Everything here follows from the operator being mid-consultation with a patient in the chair.

**The critical loop — under 60 seconds, never leaving the calendar:**

Click appointment → side panel → write note → **Complete & Charge** → payment defaults to full amount in cash → confirm → receipt printed → done.

- **Today is the home screen.** Notes, charges, payments and documents all happen in panels over the day view.
- **Pre-fill everything.** The appointment knows the patient, service, price and date. The default path should need zero edits.
- **One-click "Paid in full, cash."** Overwhelmingly the common case — a button, not a form.
- **Command palette (⌘K)** using shadcn's `Command`. A solo operator does the same eight things all day and will learn keyboard paths fast.
- **Inline patient creation** from the booking dialog. Never force abandoning a flow.
- **Balance always visible** on the patient page header.
- **Tablet-first clinical panel.** A solo dentist is standing at the chair.
- **No approvals, no assignment, no task queues, no internal notifications.** There is nobody to hand off to.

---

## 15. Convex architecture notes

- **Actions for all network I/O** — email, SMS, PDF generation if external. Mutations cannot make network calls.
- **`ctx.scheduler`** for appointment reminders and installment due dates. Replaces a whole queue infrastructure and is one of the best reasons to be on this stack.
- **`crons.ts`** for the nightly overdue sweep and balance reconciliation.
- **Search index** on `patients.searchBlob`.
- **No joins.** Denormalize what the calendar and lists need (practitioner name, service name and colour) onto the row, kept consistent in the mutation that changes the source.
- **Transactional counters** for document numbering — read and write in the same mutation, no race possible.
- **File storage** — always verify the requesting user is entitled to the file before returning a storage URL. Convex storage URLs are unguessable but not access-controlled, so a leaked URL bypasses every check you have. This is the one rule that survives dropping tenancy.
- **Optimistic updates** on drag-to-reschedule.
- **Per-clinic full data export** from day one. Clinics will ask, and it doubles as the GDPR requirement.
- **shadcn** — build `DataTable`, `EntityDrawer` and `FormField` primitives early. Most of this app is tables and forms.

---

## 16. Open decisions

**1. Is dental the beachhead?** Still gated, and the reason is a cross-phase dependency: `toothRef` sits in the Phase-2 course item schema, and Phase-1 charges point at course items via `sourceId`. If dental is the answer, `toothRef` needs a real structure (tooth number + surfaces) rather than a string, and the odontogram moves forward. Dental is the largest private segment in Albania and carries the tourism upside, so I'd expect yes — but decide before Phase 1 charges ship, not after.

**2. Document labelling wording.** Get the exact Albanian phrasing for "this is not a fiscal invoice" from an accountant before the first clinic hands one to a patient.

**3. Charge-on-acceptance or charge-on-completion for courses?** Default is on completion, so the balance reflects work actually done. Some clinics will want the whole course charged at acceptance so the receivable is visible. Make it a clinic setting, but pick a default and don't build both UIs.

---

## 17. Phase plan

### Phase 1 — MVP

- Auth: email/password + Google, single owner user, `isPractitioner` flag
- Onboarding wizard: clinic details, seeded services by clinic type, working hours
- Patients: registry, `searchBlob` search, duplicate detection on phone/NID, archive
- Patient page: Overview · Appointments · Billing
- Scheduling: day/week, practitioner columns, status colours, drag move + resize
- Double-booking blocked in the mutation, real-time via Convex subscriptions
- Check-in flow, walk-in button, working hours per practitioner
- **Charges + payments + documents tables in final shape, only one path exposed**
- Complete appointment → charge at snapshot price → "Paid in full, cash" button
- Balance in the patient header, receipt PDF, transactional number counter
- **Non-fiscal footer and `RC-2026-0042` numbering on that receipt** — see the note below
- Audit rows written from day one (viewer comes later)

### Phase 2

- Clinical notes: chart, field-primitive templates, seeded library by clinic type
- Note signing + amend-after-sign appending to the audit trail
- Treatment courses: builder, statuses, proposal PDF labelled as a quote, item ↔ appointment linking
- Second user + assistant role (no clinical notes) — the Law 124/2024 line
- Reminders and confirmations over email + SMS, templates with variables
- File uploads with category tags
- Audit log viewer, consent capture, export / rectify / erase-as-pseudonymization
- English UI alongside Albanian
- Flat Outstanding list (one query, don't leave it to phase 3)

### Phase 3

- FIFO auto-allocation + manual override, credit on overpayment, refunds as negative payments
- Document generation dialog: kind, selection, payer, language, void/reissue, provenance
- Payment plans: generator, edit, settle, convert, recalculate, cancel
- Payments apply to balance, not to installments
- Nightly overdue cron, installment reminders via `ctx.scheduler`
- Per-service `vatRate` + exemption reason
- Option A fiscal: "to fiscalize" worklist, CSV export
- Fiscal capture: manual → QR URL paste → PDF regex, then bulk reconcile
- `FiscalProvider` interface with a no-op
- Finances screen: Today · Outstanding · Reports, dashboard money widgets

### Later

WhatsApp · recalls · waitlist · rooms · multi-location · before/after photos · products + stock · expenses · commissions · 2FA · consent e-signature · patient portal · online booking · Stripe subscriptions · fiscalization via a certified provider · remaining languages

### Two notes on the sequencing

**The non-fiscal footer belongs in Phase 1, not Phase 3.** Everything else in the Option A block can wait, but the moment a pilot clinic prints a Phase-1 receipt and hands it to a patient, that document needs to say plainly that it isn't a fiscal invoice — and it needs numbering shaped unlike the fiscal `12/2026/TCRcode` format. Those two details are an afternoon of work and they're the difference between a receipt and something a patient could reasonably mistake for a fatura fiskale.

**Courses in Phase 2 without payment plans in Phase 3 is fine, and it's a good sign.** A clinic can accept a 240,000 ALL course in Phase 2 and take ad-hoc payments against the balance with no plan at all — charges exist, payments reduce the balance, the header shows what's left. The plan is only a projection layered on top. That the model degrades this gracefully is evidence the ledger-first decision in §7.1 was the right one.

---

## 18. This week

1. **Decide the beachhead** (§16.1) — it gates the schema
2. **Ask an accountant** the two questions: correct labelling for a non-fiscal document, and how advance payments on a treatment plan should be documented
3. **Issue one real invoice in the SelfCare portal** and scan its QR. That tells you the verification URL's parameter names (§7.9.1), whether a daily export exists, and what the PDF looks like — three answers that shape the reconcile feature
4. **Build the ledger first.** Charges, payments, balance, document generation. Everything else in the app is a well-understood CRUD problem; this is the part that's actually novel, and it's the part that decides whether the product is good.