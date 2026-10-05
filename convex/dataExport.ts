import { query } from "./_generated/server";
import { requireOwner } from "./lib/auth_helpers";

// Spec Sec15: "Per-clinic full data export from day one. Clinics will
// ask, and it doubles as the GDPR requirement." This is the operator-level
// backup/export (every operational table, as a JSON file the owner can
// save locally) -- not the per-patient data-subject-rights export from
// Sec11 ("export (JSON/PDF), rectify, erase" for a single patient's own
// record), which is a separate, not-yet-built feature with different
// access rules (a patient's own data, not the whole clinic's).
export const exportAllData = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);

    const [
      clinic,
      services,
      patients,
      appointments,
      charges,
      payments,
      documents,
      paymentPlans,
      installments,
      users,
    ] = await Promise.all([
      ctx.db.query("clinic").first(),
      ctx.db.query("services").collect(),
      ctx.db.query("patients").collect(),
      ctx.db.query("appointments").collect(),
      ctx.db.query("charges").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("paymentPlans").collect(),
      ctx.db.query("installments").collect(),
      ctx.db.query("users").collect(),
    ]);

    return {
      exportedAt: Date.now(),
      clinic,
      services,
      patients,
      appointments,
      charges,
      payments,
      documents,
      paymentPlans,
      installments,
      users: users.map((u) => ({ name: u.name, email: u.email, role: u.role, isPractitioner: u.isPractitioner })),
    };
  },
});
