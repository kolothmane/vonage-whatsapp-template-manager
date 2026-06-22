export const SUPPORTED_BRANDS = [
  "AB",
  "AD",
  "BNT",
  "CH",
  "CLB",
  "DBS",
  "JPG",
  "KA",
  "LAP",
  "LDS",
  "NR",
  "PEN",
  "PR",
  "SHA",
] as const;
export const SUPPORTED_LANGUAGES = ["EN", "FR", "ES", "PT", "IT", "DE"] as const;

export const LANGUAGE_MAP = {
  EN: "en",
  FR: "fr",
  ES: "es",
  PT: "pt",
  IT: "it",
  DE: "de",
} as const;

export const TEMPLATE_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
export const ISSUE_SEVERITIES = ["INFO", "WARNING", "ERROR"] as const;
export const IMPORT_STATUSES = ["Pending", "Submitted", "Approved", "Rejected", "Failed", "Skipped"] as const;

export type SupportedBrand = (typeof SUPPORTED_BRANDS)[number];
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type WhatsAppLanguage = (typeof LANGUAGE_MAP)[SupportedLanguage];
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export type Role = "Admin" | "Operator" | "Viewer";

export type Waba = {
  id: string;
  name: string;
  status: "Connected" | "Syncing" | "Action Required";
  country: string;
  templateCount: number;
  lastSyncAt: string;
};

export type TemplateRecord = {
  id: string;
  wabaId: string;
  wabaName: string;
  brand: SupportedBrand;
  language: SupportedLanguage;
  whatsappLanguage: WhatsAppLanguage;
  originalName: string;
  generatedName: string;
  body: string;
  category: TemplateCategory;
  automation: string;
  status: ImportStatus;
  variableMappings: VariableMapping[];
  createdAt: string;
  updatedAt: string;
};

export type ImportRecord = {
  id: string;
  fileName: string;
  target: string;
  mode: "STRICT" | "RELAXED";
  status: "Queued" | "Validating" | "Blocked" | "Processing" | "Completed" | "Failed";
  total: number;
  submitted: number;
  failed: number;
  skipped: number;
  duplicates: number;
  createdAt: string;
};

export type LogRecord = {
  id: string;
  importId: string;
  wabaId: string;
  wabaName: string;
  templateName: string;
  brand: SupportedBrand;
  language: SupportedLanguage;
  status: ImportStatus;
  message: string;
  timestamp: string;
};

export type AuditLogRecord = {
  id: string;
  user: string;
  action: "Create" | "Update" | "Delete" | "Submit" | "Retry";
  entity: string;
  oldValue?: string;
  newValue?: string;
  date: string;
};

export type ImportRow = {
  BRAND: string;
  Language: string;
  Template: string;
  "Template Name": string;
  "Template Body": string;
  "Body Variables"?: string;
  "Body Parameters"?: string;
  "Template Type": string;
  Automation?: string;
};

export type VariableMapping = {
  placeholder: `{{${number}}}`;
  key: string;
  source: string;
};

export type NormalizedTemplate = {
  rowNumber: number;
  brand: SupportedBrand;
  language: SupportedLanguage;
  whatsappLanguage: WhatsAppLanguage;
  originalName: string;
  generatedName: string;
  body: string;
  normalizedBody: string;
  category: TemplateCategory;
  automation: string;
  variableMappings: VariableMapping[];
};

export type ValidationIssue = {
  rowNumber?: number;
  field?: string;
  severity: IssueSeverity;
  code: string;
  message: string;
};

export type ValidationReport = {
  valid: boolean;
  summary: {
    totalRows: number;
    errors: number;
    warnings: number;
    infos: number;
    duplicates: number;
  };
  issues: ValidationIssue[];
  templates: NormalizedTemplate[];
};

export type VonageTemplatePayload = {
  name: string;
  language: WhatsAppLanguage;
  category: TemplateCategory;
  components: Array<{
    type: "BODY";
    text: string;
    example?: {
      body_text: string[][];
    };
  }>;
  metadata: {
    brand: SupportedBrand;
    automation: string;
    variable_mappings: VariableMapping[];
  };
};
