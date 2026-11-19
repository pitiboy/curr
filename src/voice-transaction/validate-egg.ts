import {
  VOICE_EGG_RESULT_FIELDS,
  VoiceParseError,
  type VoiceEggMemberQuantityRow,
  type VoiceEggParseContext,
  type VoiceEggParseResult,
  type VoiceEggQuantityRow,
  type VoiceEggResultField,
} from './types';

const MAX_WARNINGS = 10;
const MAX_WARNING_LENGTH = 300;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function parsePositiveIntAmount(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/\s/g, '').replace(',', '.'))
        : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

/**
 * Validates egg-bulk LLM output against hen-house and member lists.
 * Unknown IDs and non-positive amounts are dropped with Hungarian warnings.
 */
export function validateVoiceEggParseOutput(
  raw: unknown,
  context: VoiceEggParseContext,
): VoiceEggParseResult {
  const record = asRecord(raw);
  if (!record) {
    throw new VoiceParseError('Az értelmező érvénytelen választ adott.', 502);
  }

  const warnings: string[] = [];
  const henById = new Map(context.henHouses.map((h) => [h.id, h.name]));
  const memberById = new Map(context.members.map((m) => [m.id, m.name]));

  let date: string | null = null;
  if (typeof record.date === 'string' && isValidIsoDate(record.date.trim())) {
    date = record.date.trim();
  } else if (record.date == null) {
    date = context.today;
  } else {
    warnings.push('A dátum nem azonosítható, a mai napot használtuk.');
    date = context.today;
  }

  const production: VoiceEggQuantityRow[] = [];
  const productionLabels: Record<string, string> = {};
  const productionSeen = new Set<string>();
  if (Array.isArray(record.production)) {
    for (const item of record.production) {
      const row = asRecord(item);
      if (!row) continue;
      const organizationId =
        typeof row.organizationId === 'string' ? row.organizationId.trim() : '';
      const amount = parsePositiveIntAmount(row.amount);
      if (!organizationId || amount == null) {
        warnings.push(
          'Egy termelési sort kihagytunk (ismeretlen ól vagy érvénytelen mennyiség).',
        );
        continue;
      }
      const name = henById.get(organizationId);
      if (!name) {
        warnings.push(
          'Egy termelési sort kihagytunk (az ól nincs a listában).',
        );
        continue;
      }
      if (productionSeen.has(organizationId)) {
        const existing = production.find(
          (p) => p.organizationId === organizationId,
        );
        if (existing) existing.amount += amount;
        continue;
      }
      productionSeen.add(organizationId);
      production.push({ organizationId, amount });
      productionLabels[organizationId] = name;
    }
  } else if (record.production != null) {
    warnings.push('A termelési lista érvénytelen volt, üresen hagytuk.');
  }

  const distribution: VoiceEggMemberQuantityRow[] = [];
  const distributionLabels: Record<string, string> = {};
  const distributionSeen = new Set<string>();
  if (Array.isArray(record.distribution)) {
    for (const item of record.distribution) {
      const row = asRecord(item);
      if (!row) continue;
      const memberId =
        typeof row.memberId === 'string' ? row.memberId.trim() : '';
      const amount = parsePositiveIntAmount(row.amount);
      if (!memberId || amount == null) {
        warnings.push(
          'Egy továbbosztási sort kihagytunk (ismeretlen tag vagy érvénytelen mennyiség).',
        );
        continue;
      }
      const name = memberById.get(memberId);
      if (!name) {
        warnings.push(
          'Egy továbbosztási sort kihagytunk (a tag nincs a listában).',
        );
        continue;
      }
      if (distributionSeen.has(memberId)) {
        const existing = distribution.find((d) => d.memberId === memberId);
        if (existing) existing.amount += amount;
        continue;
      }
      distributionSeen.add(memberId);
      distribution.push({ memberId, amount });
      distributionLabels[memberId] = name;
    }
  } else if (record.distribution != null) {
    warnings.push('A továbbosztási lista érvénytelen volt, üresen hagytuk.');
  }

  const rawConfidence =
    typeof record.confidence === 'number' ? record.confidence : 0;
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;

  const known = new Set<string>(VOICE_EGG_RESULT_FIELDS);
  const lowConfidence = Array.isArray(record.low_confidence_fields)
    ? record.low_confidence_fields.filter(
        (field): field is VoiceEggResultField =>
          typeof field === 'string' && known.has(field),
      )
    : [];

  const modelWarnings = Array.isArray(record.warnings)
    ? record.warnings
        .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
        .map((w) => w.trim().slice(0, MAX_WARNING_LENGTH))
    : [];

  return {
    date,
    production,
    distribution,
    confidence,
    low_confidence_fields: [...new Set(lowConfidence)],
    warnings: [...warnings, ...modelWarnings].slice(0, MAX_WARNINGS),
    labels: {
      production: productionLabels,
      distribution: distributionLabels,
    },
  };
}
