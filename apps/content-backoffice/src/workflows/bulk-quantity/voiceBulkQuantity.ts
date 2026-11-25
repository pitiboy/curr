import type { ContentHttpClient } from '../../data/receiptDraft';
import {
  parseVoiceUrl,
  VOICE_LOW_CONFIDENCE_THRESHOLD,
  VOICE_TRANSACTION_FEATURE_KEY,
} from '../../data/voiceTransaction';

export { VOICE_TRANSACTION_FEATURE_KEY };

export type VoiceEggQuantityRow = {
  organizationId: string;
  amount: number;
};

export type VoiceEggMemberQuantityRow = {
  memberId: string;
  amount: number;
};

/** Response `data` of parse-voice with `workflowId: egg-production`. */
export type VoiceEggParseResult = {
  date: string | null;
  production: VoiceEggQuantityRow[];
  distribution: VoiceEggMemberQuantityRow[];
  confidence: number;
  low_confidence_fields: string[];
  warnings: string[];
  labels: {
    production?: Record<string, string>;
    distribution?: Record<string, string>;
  };
};

export type VoiceEggBulkFormPlan = {
  date: string | null;
  /** Merged into hen-house quantity inputs (documentId → string). */
  quantities: Record<string, string>;
  /** Merged into member quantity inputs (memberId → string). */
  memberQuantities: Record<string, string>;
  filledProductionIds: string[];
  filledDistributionIds: string[];
  lowConfidenceProduction: boolean;
  lowConfidenceDistribution: boolean;
  lowConfidenceDate: boolean;
  warnings: string[];
};

function isEggParseResult(value: unknown): value is VoiceEggParseResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.production) &&
    Array.isArray(record.distribution) &&
    !('debit_account' in record)
  );
}

/**
 * Maps a validated egg-bulk voice response into form quantity patches.
 * Does not clear houses/members the model omitted.
 */
export function mapVoiceEggParseToBulk(
  result: VoiceEggParseResult,
  threshold: number = VOICE_LOW_CONFIDENCE_THRESHOLD,
): VoiceEggBulkFormPlan {
  const quantities: Record<string, string> = {};
  const memberQuantities: Record<string, string> = {};
  const filledProductionIds: string[] = [];
  const filledDistributionIds: string[] = [];

  for (const row of result.production) {
    if (
      typeof row.organizationId !== 'string' ||
      !row.organizationId ||
      typeof row.amount !== 'number' ||
      !Number.isFinite(row.amount) ||
      row.amount <= 0
    ) {
      continue;
    }
    quantities[row.organizationId] = String(Math.round(row.amount));
    filledProductionIds.push(row.organizationId);
  }

  for (const row of result.distribution) {
    if (
      typeof row.memberId !== 'string' ||
      !row.memberId ||
      typeof row.amount !== 'number' ||
      !Number.isFinite(row.amount) ||
      row.amount <= 0
    ) {
      continue;
    }
    memberQuantities[row.memberId] = String(Math.round(row.amount));
    filledDistributionIds.push(row.memberId);
  }

  const lowAll = result.confidence < threshold;
  const lowFields = new Set(result.low_confidence_fields);

  return {
    date: result.date,
    quantities,
    memberQuantities,
    filledProductionIds,
    filledDistributionIds,
    lowConfidenceDate: lowAll || lowFields.has('date'),
    lowConfidenceProduction: lowAll || lowFields.has('production'),
    lowConfidenceDistribution: lowAll || lowFields.has('distribution'),
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
  };
}

export async function parseVoiceEggTranscript(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  body: {
    transcript: string;
    organizationId: string | null;
    workflowId: string;
  },
): Promise<VoiceEggParseResult> {
  const { json } = (await httpClient(parseVoiceUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify(body),
  })) as { json?: { data?: unknown } };
  const data = json?.data;
  if (!isEggParseResult(data)) {
    throw new Error('Empty or unexpected egg parse-voice response');
  }
  return {
    ...data,
    production: Array.isArray(data.production) ? data.production : [],
    distribution: Array.isArray(data.distribution) ? data.distribution : [],
    low_confidence_fields: Array.isArray(data.low_confidence_fields)
      ? data.low_confidence_fields
      : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    labels: data.labels ?? {},
  };
}
