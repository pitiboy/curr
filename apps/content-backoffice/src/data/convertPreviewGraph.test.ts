import { describe, expect, it } from 'vitest';

import type { ConvertPreview } from './convertPreview';
import {
  formatSequenceAmount,
  layoutSequenceDiagram,
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

describe('layoutSequenceDiagram', () => {
  it('orders messages original then storno then step', () => {
    const layout = layoutSequenceDiagram(previewFixture);
    expect(layout.messages.map((row) => row.kind)).toEqual([
      'original',
      'storno',
      'step',
    ]);
  });

  it('places participants left-to-right by first appearance (credit then debit)', () => {
    const layout = layoutSequenceDiagram(previewFixture);
    expect(layout.participants.map((row) => row.code)).toEqual([
      '2000',
      '5440',
      '1100',
    ]);
    for (let index = 1; index < layout.participants.length; index += 1) {
      expect(layout.participants[index]!.x).toBeGreaterThan(
        layout.participants[index - 1]!.x,
      );
    }
  });

  it('draws messages credit → debit', () => {
    const layout = layoutSequenceDiagram(previewFixture);
    expect(layout.messages[0]).toMatchObject({
      fromId: 'c1',
      toId: 'd1',
    });
  });

  it('uses member pastel fill for 1101/1001', () => {
    const preview: ConvertPreview = {
      ...previewFixture,
      movements: [],
      original: {
        ...previewFixture.original,
        debit: { documentId: 'm', code: '1101', name: 'Tag' },
      },
    };
    const layout = layoutSequenceDiagram(preview);
    const member = layout.participants.find((row) => row.code === '1101');
    expect(member?.isMember).toBe(true);
    expect(member?.headerFill).toContain('FFE0B2');
  });

  it('detects self-loop messages', () => {
    const preview: ConvertPreview = {
      ...previewFixture,
      movements: [
        {
          kind: 'step',
          index: 0,
          description: 'loop',
          amount: 1,
          currency: { documentId: 'cur', code: 'HUF', name: null },
          debit: { documentId: 'same', code: '1001', name: null },
          credit: { documentId: 'same', code: '1001', name: null },
          percent: 100,
          copyReceipt: false,
          organizationDocumentId: null,
        },
      ],
    };
    const layout = layoutSequenceDiagram(preview);
    expect(layout.messages.at(-1)?.selfLoop).toBe(true);
  });
});

describe('formatSequenceAmount', () => {
  it('includes currency code', () => {
    expect(formatSequenceAmount(324, 'EGG')).toContain('EGG');
  });
});
