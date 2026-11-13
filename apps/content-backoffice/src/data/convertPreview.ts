import type { ContentHttpClient } from './receiptDraft';

export type PreviewAccount = {
  documentId: string;
  code: string;
  name: string | null;
};

export type PreviewCurrency = {
  documentId: string;
  code: string | null;
  name: string | null;
};

export type PreviewMovement = {
  kind: 'storno' | 'step';
  index: number | null;
  description: string;
  amount: number;
  currency: PreviewCurrency;
  debit: PreviewAccount;
  credit: PreviewAccount;
  percent: number | null;
  copyReceipt: boolean;
  organizationDocumentId: string | null;
  /** Set on `apply_currency_rate` steps (currency-rate used by Convert). */
  rate?: PreviewAppliedRate | null;
  /** Member ratio (`rules[<source currency>]`) that multiplied this step. */
  memberRatio?: PreviewMemberRatio | null;
};

export type PreviewMemberRatio = {
  ratio: number;
  membershipDocumentId: string | null;
  membershipName: string | null;
  source: 'membership' | 'membership_type';
};

/** `{ ratio, membership }` for the preview caption; null when no ratio applied. */
export function memberRatioLabelParts(
  memberRatio: PreviewMemberRatio | null | undefined,
): { ratio: string; membership: string } | null {
  if (!memberRatio || !Number.isFinite(memberRatio.ratio)) return null;
  return {
    ratio: memberRatio.ratio.toLocaleString('hu-HU', {
      maximumFractionDigits: 6,
    }),
    membership: memberRatio.membershipName?.trim() || '—',
  };
}

export type PreviewAppliedRate = {
  fromCurrencyDocumentId: string;
  toCurrencyDocumentId: string;
  rate: number;
  /** null when source and step currency match (implicit rate 1). */
  validFrom: string | null;
  currencyRateDocumentId: string | null;
  /** True when the rate came from `1 / rate(to → from)` (KOR pairs only). */
  inverted?: boolean;
};

/** `{ rate, validFrom }` for the preview table, or null without a rate. */
export function appliedRateLabelParts(
  rate: PreviewAppliedRate | null | undefined,
): { rate: string; validFrom: string | null } | null {
  if (!rate || !Number.isFinite(rate.rate)) return null;
  return {
    rate: rate.rate.toLocaleString('hu-HU', { maximumFractionDigits: 6 }),
    validFrom: rate.validFrom ? rate.validFrom.slice(0, 10) : null,
  };
}

export type ConvertPreview = {
  workflow: {
    documentId: string;
    name: string | null;
    keepOriginal: boolean;
    stepsPublished: boolean;
  };
  original: {
    amount: number;
    currency: PreviewCurrency;
    debit: PreviewAccount;
    credit: PreviewAccount;
    description: string;
  };
  movements: PreviewMovement[];
  warnings: string[];
};

export type InlinePreviewTransaction = {
  date: string;
  amount: number;
  description?: string | null;
  debit_account: { documentId: string };
  credit_account: { documentId: string };
  currency_type: { documentId: string };
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  receiptCount?: number;
};

export type ConvertPreviewRequest =
  | {
      workflowDocumentId: string;
      transactionDocumentId: string;
    }
  | {
      workflowDocumentId: string;
      transaction: InlinePreviewTransaction;
    };

type ConvertPreviewResponse = {
  data?: ConvertPreview | null;
  error?: { message?: string; status?: number };
};

export function convertPreviewUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transaction-workflows/convert-preview`;
}

export async function fetchConvertPreview(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: ConvertPreviewRequest,
): Promise<ConvertPreview> {
  const { json } = (await httpClient(convertPreviewUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify(input),
  })) as { json: ConvertPreviewResponse };
  if (json.data) return json.data;
  const message =
    json.error?.message ?? 'Convert preview response missing data';
  const error = new Error(message) as Error & { status?: number };
  error.status = json.error?.status;
  throw error;
}
