export type DocumentKind =
  | "receipt"
  | "invoice"
  | "proforma"
  | "quote"
  | "statement";

export const DOCUMENT_PREFIX: Record<DocumentKind, string> = {
  receipt: "RC",
  invoice: "FT",
  proforma: "PF",
  quote: "OF",
  statement: "ST",
};

// TODO(DECISION/LEGAL): spec Sec16.2 -- confirm the exact Albanian wording
// for "this is not a fiscal invoice" with an accountant before any real
// clinic hands a Phase-1 receipt to a patient. This placeholder must not
// ship to a pilot clinic as-is.
export const NON_FISCAL_FOOTER: Record<"sq" | "en", string> = {
  sq: "KUJDES: Ky dokument NUK ËSHTË faturë tatimore/fiskale. [PLACEHOLDER -- NEEDS LEGAL REVIEW, Sec16.2]",
  en: "This is not a fiscal invoice.",
};

export type ClinicType =
  | "dental"
  | "aesthetic"
  | "physio"
  | "general"
  | "dermatology"
  | "gynecology"
  | "multi-specialty";

export type ServiceSeed = {
  name: string;
  durationMin: number;
  price: number;
  colour: string;
  vatRate: number;
  vatExemptReason?: string;
};

// Medical/dental care by licensed practitioners is VAT-exempt in Albania
// under Law 92/2014 (spec Sec7.10) -- every seeded clinical service defaults
// to vatRate: 0 with that exemption reason. Prices are placeholder ALL
// amounts meant to be edited during onboarding (spec Sec4: clinics *edit*
// pre-seeded services rather than create them from scratch).
const MEDICAL_VAT_EXEMPT_REASON = "Law 92/2014 medical exemption";

export const CLINIC_TYPE_SEED_SERVICES: Record<ClinicType, ServiceSeed[]> = {
  dental: [
    { name: "Consultation", durationMin: 30, price: 2000, colour: "#4f46e5", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Dental Cleaning", durationMin: 45, price: 4000, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Filling", durationMin: 45, price: 6000, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Extraction", durationMin: 30, price: 5000, colour: "#dc2626", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Root Canal", durationMin: 60, price: 15000, colour: "#dc2626", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Teeth Whitening", durationMin: 60, price: 12000, colour: "#f59e0b", vatRate: 0.2, vatExemptReason: undefined },
  ],
  aesthetic: [
    { name: "Consultation", durationMin: 30, price: 2500, colour: "#4f46e5", vatRate: 0.2 },
    { name: "Botox", durationMin: 30, price: 25000, colour: "#db2777", vatRate: 0.2 },
    { name: "Dermal Filler", durationMin: 45, price: 30000, colour: "#db2777", vatRate: 0.2 },
    { name: "Chemical Peel", durationMin: 45, price: 8000, colour: "#f59e0b", vatRate: 0.2 },
    { name: "Laser Hair Removal", durationMin: 30, price: 6000, colour: "#f59e0b", vatRate: 0.2 },
  ],
  physio: [
    { name: "Initial Assessment", durationMin: 45, price: 3000, colour: "#4f46e5", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Physiotherapy Session", durationMin: 45, price: 2500, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Manual Therapy", durationMin: 30, price: 2000, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Sports Rehabilitation", durationMin: 60, price: 3500, colour: "#059669", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
  ],
  general: [
    { name: "General Consultation", durationMin: 20, price: 2000, colour: "#4f46e5", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Follow-up Visit", durationMin: 15, price: 1500, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Vaccination", durationMin: 15, price: 1000, colour: "#059669", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Blood Test Panel", durationMin: 15, price: 3000, colour: "#f59e0b", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
  ],
  dermatology: [
    { name: "Skin Consultation", durationMin: 30, price: 3000, colour: "#4f46e5", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Mole Check", durationMin: 20, price: 2500, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Acne Treatment", durationMin: 30, price: 4000, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Cryotherapy", durationMin: 20, price: 3500, colour: "#dc2626", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
  ],
  gynecology: [
    { name: "Gynecological Consultation", durationMin: 30, price: 3500, colour: "#4f46e5", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Ultrasound", durationMin: 30, price: 4000, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Pap Smear", durationMin: 20, price: 2500, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Prenatal Checkup", durationMin: 30, price: 3000, colour: "#059669", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
  ],
  "multi-specialty": [
    { name: "General Consultation", durationMin: 30, price: 2500, colour: "#4f46e5", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
    { name: "Follow-up Visit", durationMin: 15, price: 1500, colour: "#0891b2", vatRate: 0, vatExemptReason: MEDICAL_VAT_EXEMPT_REASON },
  ],
};

// Spec Sec8: "Note templates from field primitives." "signature" here is a
// typed attestation ("I certify this is accurate" + author name at sign
// time), not a drawn pad -- and "file"/"body-dental-chart" primitives are
// deliberately omitted: there's no upload UI yet (schema.ts's `files` table
// note), and the odontogram is gated on the still-open dental-beachhead
// decision (Sec16.1).
export type NoteFieldType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "date"
  | "signature";

export type NoteFieldSeed = {
  id: string;
  label: string;
  type: NoteFieldType;
  options?: string[];
};

export type NoteTemplateSeed = {
  name: string;
  fields: NoteFieldSeed[];
};

// One seeded template per clinic type (spec Sec8: "dental exam, physio SOAP,
// aesthetic consultation, general consultation... what makes the app feel
// finished on day one"). Clinic-owned and clonable in the data model
// (noteTemplates table), though the template *builder* UI itself is a later
// step -- these seeds are usable as-is from day one.
export const CLINIC_TYPE_SEED_NOTE_TEMPLATES: Record<ClinicType, NoteTemplateSeed[]> = {
  dental: [
    {
      name: "Dental Exam",
      fields: [
        { id: "chief_complaint", label: "Chief complaint", type: "textarea" },
        { id: "teeth_examined", label: "Teeth examined", type: "text" },
        { id: "diagnosis", label: "Diagnosis", type: "textarea" },
        { id: "treatment_plan", label: "Treatment plan", type: "textarea" },
        { id: "anaesthetic_used", label: "Anaesthetic used", type: "checkbox" },
        { id: "follow_up", label: "Follow-up needed", type: "radio", options: ["Yes", "No"] },
      ],
    },
  ],
  physio: [
    {
      name: "Physio SOAP Note",
      fields: [
        { id: "subjective", label: "Subjective", type: "textarea" },
        { id: "objective", label: "Objective", type: "textarea" },
        { id: "assessment", label: "Assessment", type: "textarea" },
        { id: "plan", label: "Plan", type: "textarea" },
        { id: "pain_level", label: "Pain level (0–10)", type: "number" },
      ],
    },
  ],
  aesthetic: [
    {
      name: "Aesthetic Consultation",
      fields: [
        { id: "areas_of_concern", label: "Areas of concern", type: "textarea" },
        {
          id: "skin_type",
          label: "Skin type",
          type: "dropdown",
          options: ["Normal", "Dry", "Oily", "Combination", "Sensitive"],
        },
        { id: "treatment_recommended", label: "Treatment recommended", type: "textarea" },
        { id: "photos_taken", label: "Photos taken", type: "checkbox" },
        { id: "consent_discussed", label: "Consent discussed", type: "checkbox" },
      ],
    },
  ],
  general: [
    {
      name: "General Consultation",
      fields: [
        { id: "chief_complaint", label: "Chief complaint", type: "textarea" },
        { id: "history", label: "History of present illness", type: "textarea" },
        { id: "examination", label: "Examination findings", type: "textarea" },
        { id: "diagnosis", label: "Diagnosis", type: "textarea" },
        { id: "plan", label: "Plan / prescription", type: "textarea" },
      ],
    },
  ],
  dermatology: [
    {
      name: "Dermatology Consultation",
      fields: [
        { id: "skin_findings", label: "Skin findings", type: "textarea" },
        { id: "affected_area", label: "Affected area", type: "text" },
        { id: "diagnosis", label: "Diagnosis", type: "textarea" },
        { id: "treatment_plan", label: "Treatment plan", type: "textarea" },
        { id: "biopsy_taken", label: "Biopsy taken", type: "checkbox" },
      ],
    },
  ],
  gynecology: [
    {
      name: "Gynecology Consultation",
      fields: [
        { id: "chief_complaint", label: "Chief complaint", type: "textarea" },
        { id: "lmp", label: "Last menstrual period", type: "date" },
        { id: "examination", label: "Examination findings", type: "textarea" },
        { id: "diagnosis", label: "Diagnosis", type: "textarea" },
        { id: "plan", label: "Plan", type: "textarea" },
      ],
    },
  ],
  "multi-specialty": [
    {
      name: "General Consultation",
      fields: [
        { id: "chief_complaint", label: "Chief complaint", type: "textarea" },
        { id: "examination", label: "Examination findings", type: "textarea" },
        { id: "diagnosis", label: "Diagnosis", type: "textarea" },
        { id: "plan", label: "Plan", type: "textarea" },
      ],
    },
  ],
};
