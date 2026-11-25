import {
  KOR_TREASURY_ACCOUNT_CODE,
  VOICE_RESULT_FIELDS,
  VoiceParseError,
  type VoiceParseContext,
  type VoiceParseResult,
  type VoiceResultField,
  type VoiceResultIdField,
} from './types';

const MAX_WARNINGS = 10;
const MAX_WARNING_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 1000;

const FIELD_LABELS_HU: Record<VoiceResultField, string> = {
  date: 'dátum',
  amount: 'összeg',
  currency_type: 'pénznem',
  debit_account: 'tartozik számla',
  credit_account: 'követel számla',
  organization: 'szervezet',
  member: 'tag',
  workflow: 'ügylet-sablon',
  description: 'leírás',
};

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

function parseAmount(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/\s/g, '').replace(',', '.'))
        : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('hu').replace(/\s+/g, ' ').trim();
}

/** True when the speaker named the KOR treasury account explicitly. */
export function transcriptNamesTreasury(
  transcript: string,
  accountName: string,
): boolean {
  const text = normalize(transcript);
  const digits = text.replace(/(\d)[\s.]+(?=\d)/g, '$1');
  if (digits.includes(KOR_TREASURY_ACCOUNT_CODE)) return true;
  if (/kincst[áa]r/.test(text)) return true;
  if (/ezeregyszáz|tizenegyszáz/.test(text)) return true;
  const name = normalize(accountName);
  return name.length > 0 && text.includes(name);
}

/**
 * Checks the raw LLM output against the context the user may see. Anything
 * not in the lists becomes `null` with a Hungarian warning.
 */
export function validateVoiceParseOutput(
  raw: unknown,
  context: VoiceParseContext,
  transcript: string,
): VoiceParseResult {
  const record = asRecord(raw);
  if (!record) {
    throw new VoiceParseError('Az értelmező érvénytelen választ adott.', 502);
  }

  const warnings: string[] = [];
  const nulled = new Set<VoiceResultField>();
  const labels: VoiceParseResult['labels'] = {};

  const warnInvalid = (field: VoiceResultField) => {
    nulled.add(field);
    warnings.push(
      `A(z) ${FIELD_LABELS_HU[field]} nem azonosítható, a mezőt üresen hagytuk.`,
    );
  };

  // date
  let date: string | null = null;
  if (typeof record.date === 'string' && isValidIsoDate(record.date.trim())) {
    date = record.date.trim();
  } else if (record.date != null) {
    warnInvalid('date');
  }

  // amount
  const amount = parseAmount(record.amount);
  if (amount == null && record.amount != null) warnInvalid('amount');

  // ID fields
  const accountsById = new Map(context.accounts.map((a) => [a.id, a]));
  const lookups: Record<VoiceResultIdField, Map<string, string>> = {
    currency_type: new Map(
      context.currencyTypes.map((c) => [
        c.id,
        [c.code, c.name].filter(Boolean).join(' '),
      ]),
    ),
    debit_account: new Map(
      context.accounts.map((a) => [
        a.id,
        [a.code, a.name].filter(Boolean).join(' '),
      ]),
    ),
    credit_account: new Map(
      context.accounts.map((a) => [
        a.id,
        [a.code, a.name].filter(Boolean).join(' '),
      ]),
    ),
    // Only organizations the user may access are in the context.
    organization: new Map(context.organizations.map((o) => [o.id, o.name])),
    member: new Map(context.members.map((m) => [m.id, m.name])),
    workflow: new Map(context.workflows.map((w) => [w.id, w.name])),
  };

  const ids = {} as Record<VoiceResultIdField, string | null>;
  for (const field of Object.keys(lookups) as VoiceResultIdField[]) {
    const value = record[field];
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id) {
      ids[field] = null;
      if (value != null && typeof value !== 'string') warnInvalid(field);
      continue;
    }
    const label = lookups[field].get(id);
    if (label === undefined) {
      ids[field] = null;
      warnInvalid(field);
      continue;
    }
    ids[field] = id;
    labels[field] = label;
  }

  // KOR treasury guard: never suggested unless explicitly dictated.
  for (const field of ['debit_account', 'credit_account'] as const) {
    const id = ids[field];
    if (!id) continue;
    const account = accountsById.get(id);
    if (
      account?.code.trim() === KOR_TREASURY_ACCOUNT_CODE &&
      !transcriptNamesTreasury(transcript, account.name)
    ) {
      ids[field] = null;
      delete labels[field];
      nulled.add(field);
      warnings.push(
        `A KÖR kincstár (${KOR_TREASURY_ACCOUNT_CODE}) számlát csak kifejezett diktálás esetén töltjük ki; a(z) ${FIELD_LABELS_HU[field]} üresen maradt.`,
      );
    }
  }

  if (
    ids.debit_account &&
    ids.credit_account &&
    ids.debit_account === ids.credit_account
  ) {
    ids.debit_account = null;
    ids.credit_account = null;
    delete labels.debit_account;
    delete labels.credit_account;
    nulled.add('debit_account');
    nulled.add('credit_account');
    warnings.push(
      'A tartozik és a követel számla azonos volt, ezért mindkettőt üresen hagytuk.',
    );
  }

  // description
  let description: string | null = null;
  if (typeof record.description === 'string' && record.description.trim()) {
    description = record.description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
  }

  // confidence
  const rawConfidence =
    typeof record.confidence === 'number' ? record.confidence : 0;
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;

  const known = new Set<string>(VOICE_RESULT_FIELDS);
  const lowConfidence = Array.isArray(record.low_confidence_fields)
    ? record.low_confidence_fields.filter(
        (field): field is VoiceResultField =>
          typeof field === 'string' &&
          known.has(field) &&
          !nulled.has(field as VoiceResultField),
      )
    : [];

  const modelWarnings = Array.isArray(record.warnings)
    ? record.warnings
        .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
        .map((w) => w.trim().slice(0, MAX_WARNING_LENGTH))
    : [];

  return {
    date,
    amount,
    currency_type: ids.currency_type,
    debit_account: ids.debit_account,
    credit_account: ids.credit_account,
    organization: ids.organization,
    member: ids.member,
    workflow: ids.workflow,
    description,
    confidence,
    low_confidence_fields: [...new Set(lowConfidence)],
    warnings: [...warnings, ...modelWarnings].slice(0, MAX_WARNINGS),
    labels,
  };
}
