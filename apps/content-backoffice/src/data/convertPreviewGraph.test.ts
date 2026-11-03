import { describe, expect, it } from 'vitest';

import type { ConvertPreview } from './convertPreview';
import {
  buildMovementSequence,
  formatSequenceAmount,
} from './convertPreviewGraph';

const previewFixture: ConvertPreview = {
  workflow: {
    documentId: 'wf-1',
    name: 'Test',
    keepOriginal: true,
    stepsPublished: true,
  },
  original: {
    amount: 1000,
    currency: { documentId: 'cur', code: 'HUF', name: 'Forint' },
    debit: { documentId: 'd1', code: '5440', name: 'Debit' },
    credit: { documentId: 'c1', code: '2000', name: 'Credit' },
    description: 'orig',
  },
  movements: [
    {
      kind: 'storno',
      index: null,
      description: 'storno',
      amount: -1000,
      currency: { documentId: 'cur', code: 'HUF', name: 'Forint' },
      debit: { documentId: 'd1', code: '5440', name: 'Debit' },
      credit: { documentId: 'c1', code: '2000', name: 'Credit' },
      percent: null,
      copyReceipt: false,
      organizationDocumentId: null,
    },
    {
      kind: 'step',
      index: 0,
      description: 'step',
      amount: 600,
      currency: { documentId: 'cur', code: 'HUF', name: 'Forint' },
      debit: { documentId: 'd1', code: '5440', name: 'Debit' },
      credit: { documentId: 'c2', code: '1100', name: 'Bank' },
      percent: 60,
      copyReceipt: false,
      organizationDocumentId: null,
    },
  ],
  warnings: [],
};

describe('buildMovementSequence', () => {
  it('orders original then storno then steps', () => {
    const frames = buildMovementSequence(previewFixture);
    expect(frames.map((frame) => frame.kind)).toEqual([
      'original',
      'storno',
      'step',
    ]);
    expect(frames.map((frame) => frame.order)).toEqual([1, 2, 3]);
  });

  it('marks member ledger accounts', () => {
    const preview: ConvertPreview = {
      ...previewFixture,
      original: {
        ...previewFixture.original,
        debit: { documentId: 'm', code: '1101', name: 'Tag' },
      },
      movements: [],
    };
    const frames = buildMovementSequence(preview);
    expect(frames[0]?.debit.isMember).toBe(true);
  });

  it('rotates step colors by index', () => {
    const frames = buildMovementSequence(previewFixture);
    expect(frames[2]?.stepColorKey).toBe('primary');
  });
});

describe('formatSequenceAmount', () => {
  it('includes currency code', () => {
    expect(formatSequenceAmount(324, 'EGG')).toContain('EGG');
  });
});
