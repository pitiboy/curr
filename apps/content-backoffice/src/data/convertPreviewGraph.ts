import type { ConvertPreview, PreviewAccount } from './convertPreview';

export const MEMBER_LEDGER_CODES = new Set(['1101', '1001']);

export const SEQUENCE_STEP_COLOR_KEYS = [
  'primary',
  'secondary',
  'success',
  'info',
] as const;

export type SequenceStepColorKey = (typeof SEQUENCE_STEP_COLOR_KEYS)[number];

export type MovementSequenceKind = 'original' | 'storno' | 'step';

export type MovementSequenceFrame = {
  id: string;
  /** 1-based display order on the timeline */
  order: number;
  kind: MovementSequenceKind;
  stepIndex: number | null;
  description: string;
  amount: number;
  currencyCode: string | null;
  percent: number | null;
  debit: PreviewAccount & { isMember: boolean };
  credit: PreviewAccount & { isMember: boolean };
  stepColorKey: SequenceStepColorKey;
};

function accountWithMemberFlag(
  account: PreviewAccount,
): PreviewAccount & { isMember: boolean } {
  return {
    ...account,
    isMember: MEMBER_LEDGER_CODES.has(account.code),
  };
}

function stepColorKey(stepIndex: number | null): SequenceStepColorKey {
  if (stepIndex == null) return 'primary';
  return SEQUENCE_STEP_COLOR_KEYS[
    stepIndex % SEQUENCE_STEP_COLOR_KEYS.length
  ]!;
}

/** Chronological frames: source row, then storno and steps in convert order. */
export function buildMovementSequence(
  preview: ConvertPreview,
): MovementSequenceFrame[] {
  const frames: MovementSequenceFrame[] = [
    {
      id: 'original',
      order: 1,
      kind: 'original',
      stepIndex: null,
      description: preview.original.description,
      amount: preview.original.amount,
      currencyCode: preview.original.currency.code,
      percent: null,
      debit: accountWithMemberFlag(preview.original.debit),
      credit: accountWithMemberFlag(preview.original.credit),
      stepColorKey: 'info',
    },
  ];

  for (const movement of preview.movements) {
    frames.push({
      id: `${movement.kind}-${movement.index ?? 'storno'}`,
      order: frames.length + 1,
      kind: movement.kind,
      stepIndex: movement.index,
      description: movement.description,
      amount: movement.amount,
      currencyCode: movement.currency.code,
      percent: movement.percent,
      debit: accountWithMemberFlag(movement.debit),
      credit: accountWithMemberFlag(movement.credit),
      stepColorKey:
        movement.kind === 'storno' ? 'secondary' : stepColorKey(movement.index),
    });
  }

  return frames;
}

export function movementSequenceAriaSummary(preview: ConvertPreview): string {
  const frames = buildMovementSequence(preview);
  return `${frames.length} sequence frames, ${preview.original.amount} ${preview.original.currency.code ?? ''}`.trim();
}

export function formatSequenceAmount(
  amount: number,
  currencyCode: string | null,
): string {
  const currency = currencyCode ?? '?';
  return `${amount.toLocaleString('hu-HU', { maximumFractionDigits: 4 })} ${currency}`;
}
