import { describe, expect, it } from 'vitest';

import type { ConvertPreview } from '../../data/convertPreview';
import {
  overridesDifferFromBaseline,
  previewToEditableRows,
  rowsToOverridePayload,
  syncAmountFromPercent,
  syncPercentFromAmount,
} from './convertPreviewEdit';

const preview: ConvertPreview = {
  workflow: {
    documentId: 'wf',
    name: 'Test',
    keepOriginal: true,
    stepsPublished: false,
  },
  original: {
    amount: 100,
    currency: { documentId: 'cur', code: 'HUF', name: null },
    debit: { documentId: 'd', code: '5440', name: null },
    credit: { documentId: 'c', code: '2000', name: null },
    description: 'src',
  },
  movements: [
    {
      kind: 'storno',
      index: null,
      description: 'storno',
      amount: -100,
      currency: { documentId: 'cur', code: 'HUF', name: null },
      debit: { documentId: 'c', code: '2000', name: null },
      credit: { documentId: 'd', code: '5440', name: null },
      percent: null,
      copyReceipt: false,
      organizationDocumentId: null,
    },
    {
      kind: 'step',
      index: 0,
      description: 'step',
      amount: 100,
      currency: { documentId: 'cur', code: 'HUF', name: null },
      debit: { documentId: 'd', code: '5440', name: null },
      credit: { documentId: 'c', code: '2000', name: null },
      percent: 100,
      copyReceipt: false,
      organizationDocumentId: 'org',
    },
  ],
  warnings: [],
};

describe('convertPreviewEdit', () => {
  it('locks original and storno rows', () => {
    const rows = previewToEditableRows(preview, '2026-11-01');
    const storno = rows.find((row) => row.kind === 'storno');
    const step = rows.find((row) => row.kind === 'step');
    expect(rows[0]?.locked).toBe(true);
    expect(storno?.locked).toBe(true);
    expect(step?.locked).toBe(false);
  });

  it('syncs percent and amount from the original', () => {
    const base = previewToEditableRows(preview, '2026-11-01').find(
      (row) => row.kind === 'step',
    )!;
    const fromAmount = syncPercentFromAmount({ ...base, amount: 50 }, 100);
    expect(fromAmount.percent).toBe(50);
    const fromPercent = syncAmountFromPercent({ ...base, percent: 25 }, 100);
    expect(fromPercent.amount).toBe(25);
  });

  it('builds override payload only from editable step rows', () => {
    const rows = previewToEditableRows(preview, '2026-11-01');
    const payload = rowsToOverridePayload(rows);
    expect(payload.length).toBe(1);
    expect(payload[0]?.sourceStepIndex).toBe(0);
  });

  it('detects when edits differ from baseline', () => {
    const baseline = previewToEditableRows(preview, '2026-11-01');
    const edited = baseline.map((row) =>
      row.kind === 'step' ? { ...row, amount: 90 } : row,
    );
    expect(overridesDifferFromBaseline(edited, baseline)).toBe(true);
    expect(overridesDifferFromBaseline(baseline, baseline)).toBe(false);
  });
});
