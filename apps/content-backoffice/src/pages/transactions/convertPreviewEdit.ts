import type {
  ConvertPreview,
  PreviewMovement,
} from '../../data/convertPreview';
import type {
  ConvertLegOverrideInput,
  ConvertOverridesPayload,
} from '../../data/transactionWorkflow';

function stepAmount(sourceAmount: number, percent: number): number {
  return (sourceAmount * percent) / 100;
}

function roundAmount(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export const CONVERT_INLINE_EDIT_FEATURE_ID = 'convert_inline_edit';

export type EditableLegKind = 'original' | 'storno' | 'step';

export type EditableLegRow = {
  key: string;
  kind: EditableLegKind;
  locked: boolean;
  sourceStepIndex: number | null;
  description: string;
  amount: number;
  percent: number | null;
  debitAccountDocumentId: string;
  creditAccountDocumentId: string;
  currencyTypeDocumentId: string;
  organizationDocumentId: string | null;
  transactionTypeDocumentId: string | null;
  copyReceipt: boolean;
  date: string;
  /** Preserved display metadata */
  debitCode: string;
  creditCode: string;
  currencyCode: string | null;
};

export function roundLegAmountForCurrency(
  amount: number,
  currencyCode: string | null,
): number {
  if (currencyCode?.trim().toUpperCase() === 'HUF') {
    return Math.round(amount);
  }
  return roundAmount(amount);
}

export function previewToEditableRows(
  preview: ConvertPreview,
  transactionDate: string,
): EditableLegRow[] {
  const rows: EditableLegRow[] = [
    {
      key: 'original',
      kind: 'original',
      locked: true,
      sourceStepIndex: null,
      description: preview.original.description,
      amount: preview.original.amount,
      percent: null,
      debitAccountDocumentId: preview.original.debit.documentId,
      creditAccountDocumentId: preview.original.credit.documentId,
      currencyTypeDocumentId: preview.original.currency.documentId,
      organizationDocumentId: null,
      transactionTypeDocumentId: null,
      copyReceipt: false,
      date: transactionDate,
      debitCode: preview.original.debit.code,
      creditCode: preview.original.credit.code,
      currencyCode: preview.original.currency.code,
    },
  ];

  for (const movement of preview.movements) {
    rows.push({
      key:
        movement.kind === 'storno'
          ? 'storno'
          : `step:${movement.index ?? movement.description}`,
      kind: movement.kind,
      locked: movement.kind !== 'step',
      sourceStepIndex: movement.index,
      description: movement.description,
      amount: movement.amount,
      percent: movement.percent,
      debitAccountDocumentId: movement.debit.documentId,
      creditAccountDocumentId: movement.credit.documentId,
      currencyTypeDocumentId: movement.currency.documentId,
      organizationDocumentId: movement.organizationDocumentId,
      transactionTypeDocumentId: null,
      copyReceipt: movement.copyReceipt,
      date: transactionDate,
      debitCode: movement.debit.code,
      creditCode: movement.credit.code,
      currencyCode: movement.currency.code,
    });
  }

  return rows;
}

function movementSnapshot(
  row: EditableLegRow,
): PreviewMovement & { kind: 'storno' | 'step' } {
  return {
    kind: row.kind as 'storno' | 'step',
    index: row.sourceStepIndex,
    description: row.description,
    amount: row.amount,
    currency: {
      documentId: row.currencyTypeDocumentId,
      code: row.currencyCode,
      name: null,
    },
    debit: {
      documentId: row.debitAccountDocumentId,
      code: row.debitCode,
      name: null,
    },
    credit: {
      documentId: row.creditAccountDocumentId,
      code: row.creditCode,
      name: null,
    },
    percent: row.percent,
    copyReceipt: row.copyReceipt,
    organizationDocumentId: row.organizationDocumentId,
    rate: null,
    memberRatio: null,
  };
}

/** Rebuild preview movements for diagram/table from editable rows. */
export function editableRowsToPreview(
  preview: ConvertPreview,
  rows: readonly EditableLegRow[],
): ConvertPreview {
  const movements: PreviewMovement[] = [];
  for (const row of rows) {
    if (row.kind === 'original') continue;
    movements.push(movementSnapshot(row));
  }
  return { ...preview, movements };
}

export type ConvertPreviewEditValidation = {
  blocking: string[];
  warnings: string[];
};

/** Complete enough to send as a convert override leg (not a blank “Új lépés” row). */
export function isCompleteEditableLeg(row: EditableLegRow): boolean {
  return (
    row.kind === 'step' &&
    !row.locked &&
    Boolean(row.debitAccountDocumentId) &&
    Boolean(row.creditAccountDocumentId) &&
    row.debitAccountDocumentId !== row.creditAccountDocumentId &&
    Number.isFinite(row.amount) &&
    row.amount > 0 &&
    Boolean(row.description.trim())
  );
}

export function validateEditableRows(
  preview: ConvertPreview,
  rows: readonly EditableLegRow[],
  translate: (key: string, options?: Record<string, unknown>) => string,
): ConvertPreviewEditValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const steps = rows.filter((row) => row.kind === 'step' && !row.locked);

  if (steps.length === 0) {
    blocking.push(
      translate('app.transactions_convert_edit_error_steps_required'),
    );
  }

  for (const row of steps) {
    if (!row.debitAccountDocumentId || !row.creditAccountDocumentId) {
      blocking.push(
        translate('app.transactions_convert_edit_error_accounts_required'),
      );
      break;
    }
    if (row.debitAccountDocumentId === row.creditAccountDocumentId) {
      blocking.push(
        translate('app.transactions_convert_edit_error_accounts_differ'),
      );
    }
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      blocking.push(
        translate('app.transactions_convert_edit_error_amount_positive'),
      );
    }
    if (!row.description.trim()) {
      blocking.push(
        translate('app.transactions_convert_edit_error_description'),
      );
    }
  }

  const stepTotal = steps.reduce((sum, row) => sum + row.amount, 0);
  const original = preview.original.amount;
  if (steps.length > 0 && Math.abs(stepTotal - original) > 0.01) {
    warnings.push(
      translate('app.transactions_convert_edit_warning_step_sum', {
        steps: stepTotal.toLocaleString('hu-HU', { maximumFractionDigits: 2 }),
        original: original.toLocaleString('hu-HU', {
          maximumFractionDigits: 2,
        }),
      }),
    );
  }

  return { blocking: [...new Set(blocking)], warnings };
}

export function syncPercentFromAmount(
  row: EditableLegRow,
  sourceAmount: number,
): EditableLegRow {
  if (!sourceAmount) return row;
  const percent = (row.amount / sourceAmount) * 100;
  return { ...row, percent: Math.round(percent * 10_000) / 10_000 };
}

export function syncAmountFromPercent(
  row: EditableLegRow,
  sourceAmount: number,
): EditableLegRow {
  if (row.percent == null || !Number.isFinite(row.percent)) return row;
  const raw = stepAmount(sourceAmount, row.percent);
  const amount = roundLegAmountForCurrency(raw, row.currencyCode);
  return { ...row, amount };
}

export function duplicateLegRow(
  row: EditableLegRow,
  key: string,
): EditableLegRow {
  return {
    ...row,
    key,
    locked: false,
    kind: 'step',
    sourceStepIndex: null,
  };
}

export function blankLegRow(
  preview: ConvertPreview,
  transactionDate: string,
  key: string,
): EditableLegRow {
  return {
    key,
    kind: 'step',
    locked: false,
    sourceStepIndex: null,
    description: '',
    amount: 0,
    percent: null,
    debitAccountDocumentId: preview.original.debit.documentId,
    creditAccountDocumentId: preview.original.credit.documentId,
    currencyTypeDocumentId: preview.original.currency.documentId,
    organizationDocumentId: null,
    transactionTypeDocumentId: null,
    copyReceipt: false,
    date: transactionDate,
    debitCode: preview.original.debit.code,
    creditCode: preview.original.credit.code,
    currencyCode: preview.original.currency.code,
  };
}

export function rowsToOverridePayload(
  rows: readonly EditableLegRow[],
): ConvertLegOverrideInput[] {
  return rows.filter(isCompleteEditableLeg).map((row) => ({
    key: row.key,
    sourceStepIndex: row.sourceStepIndex,
    description: row.description,
    amount: row.amount,
    percent: row.percent,
    debitAccountDocumentId: row.debitAccountDocumentId,
    creditAccountDocumentId: row.creditAccountDocumentId,
    currencyTypeDocumentId: row.currencyTypeDocumentId,
    organizationDocumentId: row.organizationDocumentId,
    transactionTypeDocumentId: row.transactionTypeDocumentId,
    copyReceipt: row.copyReceipt,
    date: row.date,
  }));
}

export function overridesDifferFromBaseline(
  rows: readonly EditableLegRow[],
  baseline: readonly EditableLegRow[],
): boolean {
  const current = rows.filter((row) => row.kind === 'step' && !row.locked);
  const base = baseline.filter((row) => row.kind === 'step' && !row.locked);
  if (current.length !== base.length) return true;
  return current.some((row, index) => {
    const other = base[index];
    if (!other) return true;
    return (
      row.description !== other.description ||
      row.amount !== other.amount ||
      row.debitAccountDocumentId !== other.debitAccountDocumentId ||
      row.creditAccountDocumentId !== other.creditAccountDocumentId ||
      row.currencyTypeDocumentId !== other.currencyTypeDocumentId ||
      (row.organizationDocumentId ?? '') !==
        (other.organizationDocumentId ?? '') ||
      row.copyReceipt !== other.copyReceipt
    );
  });
}

/** Build convert overrides from edit state; null when nothing differs from the template. */
export function buildConvertOverridePayload(input: {
  editMode: boolean;
  blocking: readonly string[];
  rows: readonly EditableLegRow[];
  baselineRows: readonly EditableLegRow[];
  keepOriginal: boolean;
  stepsPublished: boolean;
  baselineKeepOriginal: boolean;
  baselineStepsPublished: boolean;
}): ConvertOverridesPayload | null {
  if (!input.editMode || input.blocking.length > 0) return null;

  const legsDiffer = overridesDifferFromBaseline(
    input.rows,
    input.baselineRows,
  );
  const keepOriginalDiffer = input.keepOriginal !== input.baselineKeepOriginal;
  const stepsPublishedDiffer =
    input.stepsPublished !== input.baselineStepsPublished;

  if (!legsDiffer && !keepOriginalDiffer && !stepsPublishedDiffer) {
    return null;
  }

  // Always send both flags when anything differs so the server applies the
  // form toggles even when only legs changed (baseline already matched).
  return {
    ...(legsDiffer ? { legs: rowsToOverridePayload(input.rows) } : {}),
    keepOriginal: input.keepOriginal,
    stepsPublished: input.stepsPublished,
  };
}
