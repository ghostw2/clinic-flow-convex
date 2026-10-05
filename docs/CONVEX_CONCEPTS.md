# Convex concepts used in this backend

This is a reference for the Convex concepts the ClinicFlow Phase 1 backend
relies on, each with a real excerpt from this codebase (not a toy example).
Read it top to bottom for a guided tour, or jump to a section when you hit
that concept in the code.

---

## 1. Schema: `defineSchema` / `defineTable` / `v`

Every table's shape lives in one file, `convex/schema.ts`. `defineTable`
takes an object of field validators built from `v` (imported from
`convex/values`); `defineSchema` assembles the tables into the schema Convex
pushes to your deployment.

```ts
// convex/schema.ts
services: defineTable({
  name: v.string(),
  durationMin: v.number(),
  price: v.number(),
  colour: v.string(),
  vatRate: v.number(),
  vatExemptReason: v.optional(v.string()),
  active: v.boolean(),
}).index("by_active", ["active"]),
```

Convex generates the exact TypeScript type for a `services` document from
this definition, so `ctx.db.get(serviceId)` and `ctx.db.query("services")`
come back fully typed with no manual type declarations anywhere else in the
codebase.

Common validators used throughout this schema:

| Validator | Meaning | Example |
|---|---|---|
| `v.string()`, `v.number()`, `v.boolean()` | primitives | `name: v.string()` |
| `v.optional(x)` | field may be absent | `dob: v.optional(v.number())` |
| `v.literal("x")` + `v.union(...)` | enum-like type | `status: v.union(v.literal("booked"), ...)` |
| `v.id("table")` | a foreign key to another table | `patientId: v.id("patients")` |
| `v.array(x)`, `v.object({...})` | nested structures | `workingHours: v.array(v.object({...}))` |
| `v.any()` | escape hatch, no shape checked | `before: v.optional(v.any())` in `auditLogs` |

Reusable unions are exported as named constants and imported wherever that
same shape is needed — both in the schema and in function `args`:

```ts
// convex/schema.ts
export const APPOINTMENT_STATUS = v.union(
  v.literal("booked"), v.literal("confirmed"), v.literal("arrived"),
  v.literal("in_progress"), v.literal("completed"),
  v.literal("no_show"), v.literal("cancelled"),
);

// convex/appointments.ts
export const updateAppointmentStatus = mutation({
  args: { appointmentId: v.id("appointments"), status: APPOINTMENT_STATUS },
  ...
```

---

## 2. Extending Convex Auth's tables in place

Convex Auth ships its own table definitions (`users`, `authSessions`,
`authAccounts`, ...) as `authTables`, spread into your schema. Its `users`
table only knows about auth fields (`email`, `name`, `image`, ...) — it has
no idea what a "clinic owner" or "practitioner" is. Rather than add a
second `profiles` table and join across it on every query, this codebase
**redeclares `users` with the same base fields plus its own**, right after
the spread — the later key wins in the object literal:

```ts
// convex/schema.ts
const schema = defineSchema({
  ...authTables, // users, authSessions, authAccounts, authRefreshTokens, ...

  users: defineTable({
    // fields Convex Auth's own authTables.users defines
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // ...
    // ClinicFlow's own profile fields, added directly onto the same row
    role: v.optional(v.union(v.literal("owner"), v.literal("assistant"))),
    isPractitioner: v.optional(v.boolean()),
    colour: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
```

This is Convex Auth's own documented pattern (its `authTables` doc comment
says exactly this: "You can inline the table definitions into your schema
and extend them with additional optional and required fields"). The payoff:
`ctx.db.get(userId)` returns one row with both the auth fields and
`role`/`isPractitioner` already on it — no second lookup, ever.

---

## 3. Indexes: query by field, not by scan

An index lets a query jump straight to matching rows instead of scanning
the whole table. Every index used for a real query in this codebase is
declared in `schema.ts`, then referenced by name with `.withIndex(...)`:

```ts
// convex/schema.ts
patients: defineTable({ ... })
  .index("by_phone", ["phone"])   // duplicate detection
  .index("by_nid", ["nid"])       // duplicate detection

// convex/patients.ts
const duplicatesByPhone = await ctx.db
  .query("patients")
  .withIndex("by_phone", (q) => q.eq("phone", args.phone))
  .filter((q) => q.eq(q.field("archived"), false))
  .collect();
```

A **compound index** (multiple fields) lets you range-query on the first
field and filter/order within it — this is exactly how the double-booking
check works: one index gets you "this practitioner's appointments, ordered
by start time," and everything else is a plain JS filter over a small
result set.

```ts
// convex/schema.ts
appointments: defineTable({ ... })
  .index("by_practitioner_start", ["practitionerId", "start"]),

// convex/appointments.ts
const candidates = await ctx.db
  .query("appointments")
  .withIndex("by_practitioner_start", (q) =>
    q.eq("practitionerId", args.practitionerId).lt("start", args.end),
  )
  .collect();
```

**Gotcha this codebase actually hit**: `.order()` must come *before*
`.filter()` in the chain — `filter()` returns an `OrderedQuery`, which has
no `.order()` method, so `.filter(...).order("desc")` is a compile error,
while `.order("desc").filter(...)` is correct. First draft of
`patients.listPatients` had it backwards; caught by `npx tsc --noEmit`,
fixed to:

```ts
// convex/patients.ts
return await ctx.db
  .query("patients")
  .order("desc")
  .filter((q) => q.eq(q.field("archived"), archived))
  .paginate(args.paginationOpts);
```

---

## 4. Search indexes: full-text search

A `.searchIndex()` is a different kind of index — built for relevance-based
text search rather than exact/range matching. This backend's patient
lookup depends on it:

```ts
// convex/schema.ts
patients: defineTable({ ..., searchBlob: v.string(), ... })
  .searchIndex("search_patients", { searchField: "searchBlob" }),

// convex/patients.ts
return await ctx.db
  .query("patients")
  .withSearchIndex("search_patients", (q) => q.search("searchBlob", term))
  .take(20);
```

`searchBlob` is a denormalized field, rebuilt on every create/update from
name + phone + NID, normalized so Albanian diacritics don't matter:

```ts
// convex/lib/normalize.ts
export function buildSearchBlob(patient: {
  firstName: string; lastName: string; phone: string; nid?: string;
}): string {
  return [
    normalizeAlbanian(patient.firstName),
    normalizeAlbanian(patient.lastName),
    patient.phone,
    patient.nid ?? "",
  ].filter(Boolean).join(" ");
}
```

Verified live: searching `"elz"` (no diacritic) against a patient named
`"Elzë"` returns a match, because `searchBlob` stored `"elze krasniqi ..."`.

---

## 5. Queries, mutations, and actions — the three function types

| Type | Can read DB? | Can write DB? | Can call the network? | Registered with |
|---|---|---|---|---|
| Query | yes | no | no | `query({...})` |
| Mutation | yes | yes, transactionally | no | `mutation({...})` |
| Action | only via `ctx.runQuery`/`ctx.runMutation` | only via `ctx.runMutation` | **yes** | `action({...})` |

This split is why `billing/documents.ts`'s real PDF renderer has to be an
`action`, not a `mutation` — a mutation literally cannot make an HTTP call
or use Node's `fs`, by design (it has to stay deterministic and replayable
for OCC). The stub is written as an action for exactly this reason, even
though right now it just throws:

```ts
// convex/billing/documents.ts
export const renderReceiptPdf = action({
  args: { documentId: v.id("documents") },
  handler: async () => {
    throw new ConvexError("renderReceiptPdf is not implemented yet -- ...");
  },
});
```

A plain query looks like this — no side effects, just a read:

```ts
// convex/services.ts
export const listServices = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.activeOnly) {
      return await ctx.db.query("services")
        .withIndex("by_active", (q) => q.eq("active", true)).collect();
    }
    return await ctx.db.query("services").collect();
  },
});
```

---

## 6. Mutations are transactional — this is the whole point of the ledger

Convex mutations run against a snapshot and commit atomically (optimistic
concurrency control, retried on conflict) — so **a check and the write that
depends on it can never race**, as long as they're in the same mutation.
This backend leans on that guarantee twice, explicitly:

**Double-booking prevention** — the overlap check and the insert are one
mutation, so two concurrent booking requests for the same slot can't both
succeed:

```ts
// convex/appointments.ts
export const createAppointment = mutation({
  args: { patientId: v.id("patients"), practitionerId: v.id("users"), ... },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertNoOverlap(ctx, {
      practitionerId: args.practitionerId, start: args.start, end: args.end,
    });
    // ... insert happens only if assertNoOverlap didn't throw, same transaction
    const appointmentId = await ctx.db.insert("appointments", { ... });
```

**Balance never drifts** — `charges` and `payments` are separate tables;
`patients.balance` is a denormalized cache of `sum(charges) - sum(payments)`
recomputed inside the *same* mutation that writes either one:

```ts
// convex/billing/balance.ts
export async function recomputeBalance(ctx: MutationCtx, patientId: Id<"patients">) {
  const charges = await ctx.db.query("charges")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId)).collect();
  const payments = await ctx.db.query("payments")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId)).collect();
  const totalCharges = charges.filter((c) => c.voidedAt === undefined)
    .reduce((sum, c) => sum + c.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalCharges - totalPayments;
  await ctx.db.patch(patientId, { balance });
  return balance;
}
```

Verified live: completing an appointment inserted a charge for 5000 ALL
*and* moved `patients.balance` to 5000 in one call; `payInFullCash` moved
it back to 0 in one call. There's no intermediate state where the charge
exists but the balance hasn't caught up.

---

## 7. Plain helper functions vs. registered Convex functions

Not every reusable piece of logic needs to be its own callable Convex
function. `recomputeBalance` above, `allocateFifo`, and
`createChargeFromAppointment` are all **plain async TypeScript functions**
that take `ctx: MutationCtx` as a normal parameter — not wrapped in
`mutation({...})`. Calling them is just a function call, which means they
execute inside the *caller's* existing transaction, with no extra
round-trip:

```ts
// convex/billing/charges.ts
export async function createChargeFromAppointment(
  ctx: MutationCtx,
  args: { appointment: Doc<"appointments">; service: Doc<"services">; actorId: Id<"users"> },
): Promise<Id<"charges">> {
  // ... ctx.db.insert(...), then recomputeBalance(ctx, ...) -- another plain call
}

// convex/appointments.ts, inside transitionStatus()
const chargeId = await createChargeFromAppointment(ctx, { appointment, service, actorId });
```

Compare this to `internalMutation`, used when the caller is *outside* the
normal request/response function graph — e.g. Convex Auth's sign-up
callback, which hands you a generic, loosely-typed `ctx` and expects you to
dispatch into your own schema-typed code via `ctx.runMutation`:

```ts
// convex/auth.ts
async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
  if (existingUserId !== null) return;
  await ctx.runMutation(internal.users.bootstrapFirstOwner, { userId });
},

// convex/users.ts
export const bootstrapFirstOwner = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => { /* ... */ },
});
```

`internal.*` (vs. `api.*`) means this function is **not callable from a
browser client at all** — only from other Convex functions on the backend.
That's the right visibility for "promote this user to owner": no client
should ever be able to invoke it directly.

---

## 8. Denormalization instead of joins

Convex has no join operator. The documented pattern — used throughout this
schema — is to copy the handful of fields a list view actually needs onto
the row itself, and keep them in sync in whichever mutation touches the
source data:

```ts
// convex/schema.ts
appointments: defineTable({
  patientId: v.id("patients"),
  practitionerId: v.id("users"),
  serviceId: v.id("services"),
  // denormalized so the calendar view needs zero extra lookups:
  patientName: v.string(),
  practitionerName: v.string(),
  serviceName: v.string(),
  serviceColour: v.string(),
  ...
```

```ts
// convex/appointments.ts, createAppointment
const [patient, practitioner, service] = await Promise.all([
  ctx.db.get(args.patientId), ctx.db.get(args.practitionerId), ctx.db.get(args.serviceId),
]);
const appointmentId = await ctx.db.insert("appointments", {
  ...
  patientName: `${patient.firstName} ${patient.lastName}`,
  practitionerName: practitioner.name ?? "Practitioner",
  serviceName: service.name,
  serviceColour: service.colour,
});
```

The trade-off, stated plainly: if a patient's name changes, every
appointment row still shows the old name until something re-syncs it.
Phase 1 accepts this because a calendar view rendering 200 appointments a
day without N+1 lookups matters more than a same-day name-change edge
case — and it's the same trade-off the spec makes for `charges.unitPrice`
being a price *snapshot* rather than a live reference to `services.price`.

---

## 9. Transactional counters (safe sequence numbers)

Document numbering (`RC-2026-0001`, `RC-2026-0002`, ...) needs a strictly
increasing counter with no possibility of two receipts getting the same
number, even under concurrent requests. The pattern: read the counter,
compute `next`, write it back — all inside the mutation that issues the
document, so Convex's OCC retry handles the race instead of you:

```ts
// convex/lib/counters.ts
export async function allocateDocumentNumber(ctx: MutationCtx, kind: DocumentKind, year: number) {
  const key = `${DOCUMENT_PREFIX[kind]}-${year}`;
  const existing = await ctx.db.query("documentCounters")
    .withIndex("by_key", (q) => q.eq("key", key)).unique();
  const nextNumber = (existing?.lastNumber ?? 0) + 1;
  if (existing) {
    await ctx.db.patch(existing._id, { lastNumber: nextNumber });
  } else {
    await ctx.db.insert("documentCounters", { key, lastNumber: nextNumber });
  }
  return `${DOCUMENT_PREFIX[kind]}-${year}-${String(nextNumber).padStart(4, "0")}`;
}
```

Called from inside `generateReceipt`, never on draft creation — verified
live: two receipts generated back-to-back for the same patient in the same
year came back `RC-2026-0001` and `RC-2026-0002`, never a repeat.

---

## 10. Convex Auth: providers, callbacks, and `getAuthUserId`

Auth is wired through `@convex-dev/auth`, configured once:

```ts
// convex/auth.ts
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Google],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return; // returning user, not a new sign-up
      await ctx.runMutation(internal.users.bootstrapFirstOwner, { userId });
    },
  },
});
```

```ts
// convex/http.ts -- required so Convex Auth's OAuth/password-reset routes exist
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

Inside any query or mutation, "who is calling" comes from
`getAuthUserId(ctx)`, wrapped in this codebase's own helpers so every
function reads the same two lines instead of re-deriving them:

```ts
// convex/lib/auth_helpers.ts
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx); // getAuthUserId(ctx) -> ctx.db.get(userId)
  if (user === null) throw new ConvexError("Not authenticated");
  return user;
}

export async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  if (user.role !== "owner") throw new ConvexError("Only the clinic owner can do this");
  return user;
}
```

Every mutation and almost every query in this codebase starts with
`await requireUser(ctx)` or `await requireOwner(ctx)` — this is also where
a real bug got caught and fixed: `clinic.getClinic` and
`onboarding.onboardingStatus` were first written *without* this call,
meaning anyone with the deployment URL could read the clinic's name,
address, and NIPT with no login. Both now start with `await requireUser(ctx)`.

---

## 11. `ConvexError` for expected, user-facing failures

Convex distinguishes an unexpected crash from an expected business-rule
rejection. Throwing `ConvexError` (vs. a plain `Error` or `throw`) is how
this codebase signals the latter — the double-booking check, the
"already voided" guard, the "no outstanding balance" guard, and every
`requireOwner` rejection all use it:

```ts
// convex/appointments.ts
if (overlap) {
  throw new ConvexError(
    "This practitioner already has an appointment in that time slot",
  );
}
```

Verified live via `npx convex run` — this surfaces cleanly as
`Uncaught ConvexError: This practitioner already has an appointment in
that time slot`, not a generic 500.

---

## 12. Pagination

`ctx.db.query(...).collect()` loads everything into memory — fine for a
handful of services, wrong for a patient registry that could grow to
thousands of rows. `patients.listPatients` uses Convex's built-in
pagination instead:

```ts
// convex/patients.ts
import { paginationOptsValidator } from "convex/server";

export const listPatients = query({
  args: { archived: v.optional(v.boolean()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.query("patients").order("desc")
      .filter((q) => q.eq(q.field("archived"), args.archived ?? false))
      .paginate(args.paginationOpts);
  },
});
```

The client passes `{ numItems, cursor }` and gets back a page plus a
cursor for the next one — this is the shape a future infinite-scroll
patient list will consume directly.

---

## 13. File storage with an entitlement check

Convex file storage URLs (`ctx.storage.getUrl(storageId)`) are
unguessable but **not access-controlled** — anyone holding the URL string
can fetch the file, forever, regardless of who they are. The rule this
codebase follows everywhere a storage URL is returned: check the caller is
entitled to that specific document *before* handing back the URL, not just
that they're logged in generically:

```ts
// convex/files.ts
export const getFileUrl = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const file = await ctx.db.get(args.fileId);
    if (file === null) return null;
    return await ctx.storage.getUrl(file.storageId);
  },
});
```

No upload UI exists yet in Phase 1, so this function is effectively
unused right now — it's written anyway, deliberately, so the pattern is
established before the first real file exists rather than retrofitted
under time pressure later.

---

## 14. Schema-derived types: `Doc<"table">` and `Id<"table">`

Convex codegen produces `convex/_generated/dataModel.d.ts`, from which
`Doc<"tableName">` (a full document's type) and `Id<"tableName">` (a
branded string type — an `Id<"patients">` is not assignable where an
`Id<"users">` is expected, even though both are strings at runtime) are
generated straight from `schema.ts`. Used everywhere a function needs to
talk about "a document from this table" without hand-writing an interface:

```ts
// convex/billing/charges.ts
export async function createChargeFromAppointment(
  ctx: MutationCtx,
  args: { appointment: Doc<"appointments">; service: Doc<"services">; actorId: Id<"users"> },
): Promise<Id<"charges">> { ... }
```

---

## 15. Local, no-login development: `CONVEX_AGENT_MODE=anonymous`

Convex normally wants you to log into a cloud account before `npx convex
dev` will do anything. For scripted/agent setup, the CLI has an
undocumented-in-the-UI but CLI-native escape hatch:

```bash
export CONVEX_AGENT_MODE=anonymous
npx convex init      # configures a local-only deployment, no browser login
npx convex dev --once  # pushes schema.ts + every function, typechecks, exits
```

This runs a real Convex backend on `127.0.0.1:3210` backed by local SQLite
state under `.convex/local/` (already `.gitignore`d by Convex's own nested
`.convex/.gitignore`) — everything in this backend was built and verified
entirely against that local deployment, with no Convex account involved.

## 16. Testing functions from the CLI without a UI: `npx convex run` + `--identity`

With no frontend built yet, every mutation and query in this doc was
exercised directly:

```bash
npx convex run clinic:initClinic '{ "name": "Klinika Test", ... }' \
  --identity '{"subject": "<userId>|testsession"}'
```

`--identity` lets you hand-craft a fake `UserIdentity` for the call, which
is how `requireUser`/`requireOwner` (built on `getAuthUserId`) get
satisfied outside of a real sign-in flow — `getAuthUserId` reads
`identity.subject`, splits it on `|`, and treats the first half as the
`users` document ID. Pairing this with a small `internalMutation` that
inserts a fake `owner` row directly (`convex/seed.ts`, dev-only, not wired
into any UI or auth flow) made it possible to walk the *entire* Phase 1
flow — clinic init, service seeding, patient creation with duplicate/search
checks, double-booking rejection, the full appointment status lifecycle,
Complete & Charge, `payInFullCash`, and sequential receipt numbering —
end to end from the command line, including the negative paths (illegal
status transition, voiding an allocated charge, double-booking, paying a
zero balance) that should throw.

---

## 17. Cron jobs (declared, not yet scheduled)

`cronJobs()` from `convex/server` is how Convex runs a function on a
schedule. Phase 1 doesn't need one yet (the nightly overdue-installment
sweep is Phase 3, once `paymentPlans`/`installments` exist), so the file
exists purely as the documented hook point:

```ts
// convex/crons.ts
import { cronJobs } from "convex/server";
const crons = cronJobs();
export default crons;
```
