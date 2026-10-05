import { internalMutation } from "./_generated/server";
import { buildSearchBlob } from "./lib/normalize";

// Dev-only helper for exercising the backend without a real sign-in flow
// (Convex Auth's password/OAuth flows are HTTP-based and can't be driven
// from `npx convex run` or the dashboard Functions tab -- see the plan's
// verification notes). Not wired into any UI or auth flow.
export const createTestOwner = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.insert("users", {
      role: "owner",
      isPractitioner: true,
      name: "Test Owner",
      email: "owner@test.local",
    });
  },
});

// Dev-only: wipes every row Convex Auth's password/OAuth flows create
// (users + its own authAccounts/authSessions/authRefreshTokens/
// authVerificationCodes/authVerifiers tables), so a browser-driven sign-up
// used for UI testing doesn't permanently claim the "first user becomes
// owner" slot (see auth.ts's afterUserCreatedOrUpdated) ahead of a real
// operator's first sign-up. Not wired into any UI.
export const resetAuthState = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "users",
      "authAccounts",
      "authSessions",
      "authRefreshTokens",
      "authVerificationCodes",
      "authVerifiers",
      "authRateLimits",
    ] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

// Dev-only: wipes scheduling/billing data created while exercising the
// calendar's "Complete & charge" loop via the browser (appointments,
// charges, payments, documents, documentCounters, services), and resets
// each patient's denormalized billing/visit fields back to their
// just-created defaults. Patient and user rows themselves are untouched.
// Not wired into any UI.
export const resetBookingAndBillingData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "appointments",
      "charges",
      "payments",
      "documents",
      "documentCounters",
      "services",
    ] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
    const patients = await ctx.db.query("patients").collect();
    for (const patient of patients) {
      await ctx.db.patch(patient._id, {
        balance: 0,
        lastVisitAt: undefined,
        lastServiceName: undefined,
        lastServiceColour: undefined,
        noShowCount: undefined,
      });
    }
  },
});

// Dev-only: clears the clinic singleton and all patients, for full cleanup
// after seedCalendarDemoData -- otherwise the next real sign-up would see
// onboarding.clinicExists === true and inherit the leftover demo clinic.
// Not wired into any UI.
export const wipeClinicAndPatients = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of [
      "clinic",
      "patients",
      "noteTemplates",
      "clinicalNotes",
      "courses",
      "courseItems",
      "paymentPlans",
      "installments",
    ] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

// Dev-only: populates a realistic "today" for visually verifying the
// tablet/mobile calendar layouts (design/png/12-14) against real data
// instead of empty states. Requires a signed-up owner + at least one
// service to already exist (run after onboarding). Not wired into any UI.
export const seedCalendarDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const owner = await ctx.db.query("users").first();
    if (!owner) throw new Error("Sign up first (no user row found).");
    const services = await ctx.db.query("services").withIndex("by_active", (q) => q.eq("active", true)).collect();
    if (services.length === 0) throw new Error("Complete onboarding first (no services found).");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const base = todayStart.getTime();
    const at = (h: number, m: number) => base + (h * 60 + m) * 60000;

    const demoPatients = [
      { firstName: "Arta", lastName: "Hoxha", phone: "+355691110001", balance: 2000, tags: ["Penicillin allergy"] },
      { firstName: "Ervin", lastName: "Shehu", phone: "+355691110002", balance: 0, tags: [] },
      { firstName: "Mirela", lastName: "Kola", phone: "+355691110003", balance: 0, tags: [] },
      { firstName: "Donika", lastName: "Rama", phone: "+355691110004", balance: 0, tags: [] },
      { firstName: "Luan", lastName: "Bregu", phone: "+355691110005", balance: 15000, tags: [] },
      { firstName: "Blerina", lastName: "Dervishi", phone: "+355691110006", balance: 0, tags: [] },
      { firstName: "Klodiana", lastName: "Meta", phone: "+355691110007", balance: 0, tags: [] },
    ];

    const patientIds = [];
    for (const p of demoPatients) {
      const id = await ctx.db.insert("patients", {
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        language: "sq",
        searchBlob: buildSearchBlob(p),
        balance: p.balance,
        archived: false,
        tags: p.tags.length > 0 ? p.tags : undefined,
      });
      patientIds.push(id);
    }

    const svc = (i: number) => services[i % services.length];
    const appts: { patientIdx: number; h: number; m: number; status: "booked" | "confirmed" | "arrived" | "in_progress" | "completed" | "no_show" }[] = [
      { patientIdx: 5, h: 8, m: 30, status: "completed" },
      { patientIdx: 6, h: 9, m: 45, status: "no_show" },
      { patientIdx: 0, h: 10, m: 30, status: "in_progress" },
      { patientIdx: 1, h: 11, m: 15, status: "arrived" },
      { patientIdx: 2, h: 12, m: 0, status: "booked" },
      { patientIdx: 3, h: 12, m: 45, status: "booked" },
      { patientIdx: 4, h: 15, m: 30, status: "booked" },
    ];

    for (const [i, a] of appts.entries()) {
      const service = svc(i);
      const patientId = patientIds[a.patientIdx];
      const patient = demoPatients[a.patientIdx];
      const start = at(a.h, a.m);
      await ctx.db.insert("appointments", {
        patientId,
        practitionerId: owner._id,
        serviceId: service._id,
        start,
        end: start + service.durationMin * 60000,
        status: a.status,
        patientName: `${patient.firstName} ${patient.lastName}`,
        practitionerName: owner.name ?? "Owner",
        serviceName: service.name,
        serviceColour: service.colour,
      });
    }
  },
});
