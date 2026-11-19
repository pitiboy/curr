/**
 * Voice-driven transaction entry: the SPA sends a Hungarian transcript, the
 * server asks an LLM for a structured draft and returns validated form values.
 * Nothing is saved here; the user reviews and saves the form manually.
 */

export const VOICE_TRANSACTION_FEATURE_KEY = 'voice_transaction_entry';

/** Ledger code of the KOR treasury account (Bankszámlák számla). */
export const KOR_TREASURY_ACCOUNT_CODE = '1100';

export const VOICE_TRANSCRIPT_MAX_LENGTH = 2000;

export type VoiceContextOrganization = { id: string; name: string };
export type VoiceContextAccount = { id: string; code: string; name: string };
export type VoiceContextCurrency = { id: string; code: string; name: string };
export type VoiceContextMember = {
  id: string;
  name: string;
  identifier: string;
};
export type VoiceContextWorkflow = {
  id: string;
  name: string;
  debit_account_code: string;
  credit_account_code: string;
  currency_code: string | null;
};

/** Everything the parser may pick from. IDs are Strapi documentIds. */
export type VoiceParseContext = {
  today: string;
  organizations: VoiceContextOrganization[];
  accounts: VoiceContextAccount[];
  currencyTypes: VoiceContextCurrency[];
  members: VoiceContextMember[];
  workflows: VoiceContextWorkflow[];
  /** documentId of the organization currently selected on the form, if any. */
  selectedOrganizationId: string | null;
};

export const VOICE_RESULT_ID_FIELDS = [
  'currency_type',
  'debit_account',
  'credit_account',
  'organization',
  'member',
  'workflow',
] as const;

export type VoiceResultIdField = (typeof VOICE_RESULT_ID_FIELDS)[number];

export const VOICE_RESULT_FIELDS = [
  'date',
  'amount',
  ...VOICE_RESULT_ID_FIELDS,
  'description',
] as const;

export type VoiceResultField = (typeof VOICE_RESULT_FIELDS)[number];

/** Validated response body of `POST /api/transactions/parse-voice`. */
export type VoiceParseResult = {
  date: string | null;
  amount: number | null;
  currency_type: string | null;
  debit_account: string | null;
  credit_account: string | null;
  organization: string | null;
  member: string | null;
  workflow: string | null;
  description: string | null;
  /** 0..1, overall confidence of the parse. */
  confidence: number;
  /** Fields the model was unsure about (subset of {@link VOICE_RESULT_FIELDS}). */
  low_confidence_fields: VoiceResultField[];
  /** Hungarian, user-facing. */
  warnings: string[];
  /** Display labels for the returned IDs (e.g. "1100 Bankszámlák számla"). */
  labels: Partial<Record<VoiceResultIdField, string>>;
};

export type VoiceActor = {
  userId: number | string;
  roleType: string;
};

export class VoiceParseError extends Error {
  status: number;
  cause?: unknown;

  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message);
    this.name = 'VoiceParseError';
    this.status = status;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
