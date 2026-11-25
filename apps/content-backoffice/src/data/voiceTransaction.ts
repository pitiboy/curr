import type { ContentHttpClient } from './receiptDraft';

/** Settings / backoffice feature row that turns the microphone button on. */
export const VOICE_TRANSACTION_FEATURE_KEY = 'voice_transaction_entry';

/** Below this overall confidence every auto-filled field is flagged. */
export const VOICE_LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Response `data` of `POST /api/transactions/parse-voice` (server-validated). */
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
  confidence: number;
  low_confidence_fields: string[];
  warnings: string[];
  labels: Partial<
    Record<
      | 'currency_type'
      | 'debit_account'
      | 'credit_account'
      | 'organization'
      | 'member'
      | 'workflow',
      string
    >
  >;
};

/** Form sources the voice result may write (react-hook-form names). */
export const VOICE_FORM_FIELDS = [
  'date',
  'amount',
  'currency_type',
  'organization',
  'description',
  'debit_account',
  'credit_account',
] as const;

export type VoiceFormField = (typeof VOICE_FORM_FIELDS)[number];

/** Fields an ügylet-sablon prefill rewrites; applied after it, only if still empty. */
const WORKFLOW_CONTROLLED_FIELDS: readonly VoiceFormField[] = [
  'currency_type',
  'debit_account',
  'credit_account',
];

export type VoiceFormPlan = {
  /** `setValue` right away. */
  immediate: Partial<Record<VoiceFormField, string | number>>;
  /** `setValue` after the workflow prefill ran, only into empty fields. */
  afterWorkflow: Partial<Record<VoiceFormField, string | number>>;
  /** Select this ügylet-sablon in the account row (prefills accounts). */
  workflowDocumentId: string | null;
  workflowLabel: string | null;
  /** Every field the plan writes (for highlighting). */
  filledFields: VoiceFormField[];
  /** Subset of `filledFields` the reviewer should double-check. */
  lowConfidenceFields: VoiceFormField[];
  /** Named member; the transaction has no member field, so it is info only. */
  memberLabel: string | null;
  warnings: string[];
};

function isVoiceFormField(value: string): value is VoiceFormField {
  return (VOICE_FORM_FIELDS as readonly string[]).includes(value);
}

/**
 * Turns the parse result into form writes. `null` values never clear what the
 * user already typed. A workflow is only selected when the dictation did not
 * name both accounts; explicit accounts then win over the template.
 */
export function mapVoiceParseToForm(
  result: VoiceParseResult,
  threshold: number = VOICE_LOW_CONFIDENCE_THRESHOLD,
): VoiceFormPlan {
  const values: Partial<Record<VoiceFormField, string | number>> = {};
  if (result.date) values.date = result.date;
  if (typeof result.amount === 'number' && Number.isFinite(result.amount)) {
    values.amount = result.amount;
  }
  if (result.currency_type) values.currency_type = result.currency_type;
  if (result.organization) values.organization = result.organization;
  if (result.description?.trim())
    values.description = result.description.trim();
  if (result.debit_account) values.debit_account = result.debit_account;
  if (result.credit_account) values.credit_account = result.credit_account;

  const useWorkflow =
    Boolean(result.workflow) &&
    !(result.debit_account && result.credit_account);

  const immediate: VoiceFormPlan['immediate'] = {};
  const afterWorkflow: VoiceFormPlan['afterWorkflow'] = {};
  for (const [field, value] of Object.entries(values) as [
    VoiceFormField,
    string | number,
  ][]) {
    if (useWorkflow && WORKFLOW_CONTROLLED_FIELDS.includes(field)) {
      afterWorkflow[field] = value;
    } else {
      immediate[field] = value;
    }
  }

  const filledFields = VOICE_FORM_FIELDS.filter((field) => field in values);
  const lowConfidence =
    result.confidence < threshold
      ? filledFields
      : filledFields.filter((field) =>
          result.low_confidence_fields.some(
            (name) => isVoiceFormField(name) && name === field,
          ),
        );

  return {
    immediate,
    afterWorkflow,
    workflowDocumentId: useWorkflow ? result.workflow : null,
    workflowLabel: useWorkflow ? (result.labels.workflow ?? null) : null,
    filledFields,
    lowConfidenceFields: lowConfidence,
    memberLabel: result.member ? (result.labels.member ?? null) : null,
    warnings: result.warnings,
  };
}

export function parseVoiceUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transactions/parse-voice`;
}

export async function parseVoiceTranscript(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  body: { transcript: string; organizationId: string | null },
): Promise<VoiceParseResult> {
  const { json } = (await httpClient(parseVoiceUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify(body),
  })) as { json?: { data?: VoiceParseResult } };
  const data = json?.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Empty parse-voice response');
  }
  return {
    ...data,
    low_confidence_fields: Array.isArray(data.low_confidence_fields)
      ? data.low_confidence_fields
      : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    labels: data.labels ?? {},
  };
}
