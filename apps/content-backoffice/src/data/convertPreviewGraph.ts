import type { ConvertPreview, PreviewAccount } from './convertPreview';

export const MEMBER_LEDGER_CODES = new Set(['1101', '1001']);

/** Layout constants (sequencediagram.org-style lifelines). */
export const SEQ_PADDING_X = 20;
export const SEQ_PADDING_Y = 16;
export const SEQ_PARTICIPANT_MIN_WIDTH = 108;
export const SEQ_PARTICIPANT_GAP = 28;
export const SEQ_HEADER_HEIGHT = 56;
export const SEQ_MESSAGE_ROW_HEIGHT = 64;
export const SEQ_SELF_LOOP_WIDTH = 36;
export const SEQ_ARROW_LABEL_MAX = 56;
export const SEQ_DESCRIPTION_MAX = 40;

/** Pastel participant header fills (by column index). */
export const SEQ_PASTEL_HEADER_FILLS = [
  '#E3F2FD',
  '#E8F5E9',
  '#F3E5F5',
  '#FFF3E0',
  '#FCE4EC',
  '#E0F7FA',
  '#F1F8E9',
  '#EDE7F6',
] as const;

export const SEQ_PASTEL_MEMBER_FILL = '#FFE0B2';

export type MovementSequenceKind = 'original' | 'storno' | 'step';

export type SequenceParticipant = {
  id: string;
  code: string;
  name: string | null;
  isMember: boolean;
  column: number;
  x: number;
  width: number;
  centerX: number;
  headerFill: string;
};

export type SequenceMessage = {
  id: string;
  order: number;
  kind: MovementSequenceKind;
  fromId: string;
  toId: string;
  y: number;
  label: string;
  description: string;
  selfLoop: boolean;
};

export type SequenceDiagramLayout = {
  width: number;
  height: number;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
};

function accountWithMember(account: PreviewAccount): PreviewAccount & {
  isMember: boolean;
} {
  return {
    ...account,
    isMember: MEMBER_LEDGER_CODES.has(account.code),
  };
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatSequenceAmount(
  amount: number,
  currencyCode: string | null,
): string {
  const currency = currencyCode ?? '?';
  return `${amount.toLocaleString('hu-HU', { maximumFractionDigits: 4 })} ${currency}`;
}

function messageLabel(
  kind: MovementSequenceKind,
  order: number,
  amount: number,
  currencyCode: string | null,
  percent: number | null,
  stepIndex: number | null,
): string {
  const amountPart = formatSequenceAmount(amount, currencyCode);
  const prefix =
    kind === 'original'
      ? 'Orig'
      : kind === 'storno'
        ? 'Storno'
        : stepIndex != null
          ? `#${stepIndex + 1}`
          : `#${order}`;
  const percentPart = percent != null ? ` (${percent}%)` : '';
  return truncate(
    `${prefix}: ${amountPart}${percentPart}`,
    SEQ_ARROW_LABEL_MAX,
  );
}

type FrameSource = {
  id: string;
  kind: MovementSequenceKind;
  stepIndex: number | null;
  description: string;
  amount: number;
  currencyCode: string | null;
  percent: number | null;
  debit: PreviewAccount;
  credit: PreviewAccount;
};

function collectFrames(preview: ConvertPreview): FrameSource[] {
  const frames: FrameSource[] = [
    {
      id: 'original',
      kind: 'original',
      stepIndex: null,
      description: preview.original.description,
      amount: preview.original.amount,
      currencyCode: preview.original.currency.code,
      percent: null,
      debit: preview.original.debit,
      credit: preview.original.credit,
    },
  ];
  for (const movement of preview.movements) {
    frames.push({
      id: `${movement.kind}-${movement.index ?? 'storno'}`,
      kind: movement.kind,
      stepIndex: movement.index,
      description: movement.description,
      amount: movement.amount,
      currencyCode: movement.currency.code,
      percent: movement.percent,
      debit: movement.debit,
      credit: movement.credit,
    });
  }
  return frames;
}

/** UML-style sequence: participants on top, messages top-to-bottom. */
export function layoutSequenceDiagram(
  preview: ConvertPreview,
): SequenceDiagramLayout {
  const frames = collectFrames(preview);
  const participantOrder: string[] = [];
  const participantById = new Map<
    string,
    PreviewAccount & { isMember: boolean }
  >();

  for (const frame of frames) {
    for (const account of [frame.credit, frame.debit]) {
      const enriched = accountWithMember(account);
      if (!participantById.has(account.documentId)) {
        participantOrder.push(account.documentId);
        participantById.set(account.documentId, enriched);
      }
    }
  }

  let pastelIndex = 0;
  const participants: SequenceParticipant[] = participantOrder.map(
    (documentId, column) => {
      const account = participantById.get(documentId)!;
      const nameLen = account.name?.length ?? 0;
      const width = Math.max(
        SEQ_PARTICIPANT_MIN_WIDTH,
        48 + account.code.length * 8 + Math.min(nameLen, 18) * 5,
      );
      const headerFill = account.isMember
        ? SEQ_PASTEL_MEMBER_FILL
        : SEQ_PASTEL_HEADER_FILLS[
            pastelIndex++ % SEQ_PASTEL_HEADER_FILLS.length
          ]!;
      return {
        id: documentId,
        code: account.code,
        name: account.name,
        isMember: account.isMember,
        column,
        x: 0,
        width,
        centerX: 0,
        headerFill,
      };
    },
  );

  let cursorX = SEQ_PADDING_X;
  for (const participant of participants) {
    participant.x = cursorX;
    participant.centerX = cursorX + participant.width / 2;
    cursorX += participant.width + SEQ_PARTICIPANT_GAP;
  }

  const messages: SequenceMessage[] = frames.map((frame, index) => ({
    id: frame.id,
    order: index + 1,
    kind: frame.kind,
    fromId: frame.credit.documentId,
    toId: frame.debit.documentId,
    y:
      SEQ_HEADER_HEIGHT +
      SEQ_PADDING_Y +
      index * SEQ_MESSAGE_ROW_HEIGHT +
      SEQ_MESSAGE_ROW_HEIGHT / 2,
    label: messageLabel(
      frame.kind,
      index + 1,
      frame.amount,
      frame.currencyCode,
      frame.percent,
      frame.stepIndex,
    ),
    description: truncate(frame.description, SEQ_DESCRIPTION_MAX),
    selfLoop: frame.debit.documentId === frame.credit.documentId,
  }));

  const width = cursorX - SEQ_PARTICIPANT_GAP + SEQ_PADDING_X;
  const height =
    SEQ_HEADER_HEIGHT +
    SEQ_PADDING_Y * 2 +
    frames.length * SEQ_MESSAGE_ROW_HEIGHT;

  return { width, height, participants, messages };
}

/** @deprecated Timeline cards; sequence layout uses layoutSequenceDiagram. */
export function buildMovementSequence(preview: ConvertPreview) {
  return collectFrames(preview).map((frame, index) => ({
    id: frame.id,
    order: index + 1,
    kind: frame.kind,
    stepIndex: frame.stepIndex,
    description: frame.description,
    amount: frame.amount,
    currencyCode: frame.currencyCode,
    percent: frame.percent,
    debit: accountWithMember(frame.debit),
    credit: accountWithMember(frame.credit),
    stepColorKey: 'primary' as const,
  }));
}

export function movementSequenceAriaSummary(preview: ConvertPreview): string {
  const layout = layoutSequenceDiagram(preview);
  return `${layout.messages.length} messages, ${layout.participants.length} accounts`;
}
