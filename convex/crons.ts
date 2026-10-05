import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Spec Sec7.6: "Nightly cron flips pending -> overdue." 2am UTC is outside
// any plausible clinic's working hours in Europe/Tirane (UTC+1/+2), so it
// never races a same-day payment being recorded during business hours.
crons.daily(
  "sweep overdue installments",
  { hourUTC: 2, minuteUTC: 0 },
  internal.billing.paymentPlans.sweepOverdueInstallments,
);

export default crons;
