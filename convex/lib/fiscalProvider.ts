// Spec Sec7.9.1: "What to build now for Phase 1: ... a FiscalProvider
// interface with a no-op implementation. Nothing else. When you integrate
// a certified Albanian provider later, you swap one file and add a
// scheduler-driven submit action." Not called from anywhere yet -- Option
// A means ClinicFlow submits nothing to the CIS -- this exists only so a
// future certified-provider integration has a stable shape to implement
// against, without reshaping the documents/fiscalRecord schema that's
// already in place.
export interface FiscalInvoiceInput {
  documentId: string;
  total: number;
  lines: Array<{ description: string; amount: number }>;
}

export interface FiscalProvider {
  registerInvoice(
    input: FiscalInvoiceInput,
  ): Promise<{ nivf: string; nslf: string; qrUrl: string; registeredAt: number }>;
  cancelInvoice(nivf: string, reason: string): Promise<void>;
  registerCashDeposit(amount: number, type: "in" | "out"): Promise<void>;
}

export class NotConfiguredError extends Error {
  constructor() {
    super(
      "No certified fiscal provider is configured. ClinicFlow runs Option A: the clinic " +
        "fiscalizes through the government portal or its own fiscal program, and ClinicFlow " +
        "never submits to the CIS directly.",
    );
    this.name = "NotConfiguredError";
  }
}

export const noopProvider: FiscalProvider = {
  async registerInvoice() {
    throw new NotConfiguredError();
  },
  async cancelInvoice() {
    throw new NotConfiguredError();
  },
  async registerCashDeposit() {
    throw new NotConfiguredError();
  },
};
