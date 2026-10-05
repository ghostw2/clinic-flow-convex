/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as billing_balance from "../billing/balance.js";
import type * as billing_charges from "../billing/charges.js";
import type * as billing_completeVisit from "../billing/completeVisit.js";
import type * as billing_documents from "../billing/documents.js";
import type * as billing_installmentSync from "../billing/installmentSync.js";
import type * as billing_paymentPlans from "../billing/paymentPlans.js";
import type * as billing_payments from "../billing/payments.js";
import type * as clinic from "../clinic.js";
import type * as clinicalNotes from "../clinicalNotes.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as dataExport from "../dataExport.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth_helpers from "../lib/auth_helpers.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_counters from "../lib/counters.js";
import type * as lib_fiscalProvider from "../lib/fiscalProvider.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as onboarding from "../onboarding.js";
import type * as patients from "../patients.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as services from "../services.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  audit: typeof audit;
  auth: typeof auth;
  "billing/balance": typeof billing_balance;
  "billing/charges": typeof billing_charges;
  "billing/completeVisit": typeof billing_completeVisit;
  "billing/documents": typeof billing_documents;
  "billing/installmentSync": typeof billing_installmentSync;
  "billing/paymentPlans": typeof billing_paymentPlans;
  "billing/payments": typeof billing_payments;
  clinic: typeof clinic;
  clinicalNotes: typeof clinicalNotes;
  courses: typeof courses;
  crons: typeof crons;
  dataExport: typeof dataExport;
  files: typeof files;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/auth_helpers": typeof lib_auth_helpers;
  "lib/constants": typeof lib_constants;
  "lib/counters": typeof lib_counters;
  "lib/fiscalProvider": typeof lib_fiscalProvider;
  "lib/money": typeof lib_money;
  "lib/normalize": typeof lib_normalize;
  onboarding: typeof onboarding;
  patients: typeof patients;
  reports: typeof reports;
  seed: typeof seed;
  services: typeof services;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
