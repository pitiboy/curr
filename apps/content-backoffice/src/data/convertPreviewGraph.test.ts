import { describe, expect, it } from 'vitest';

import type { ConvertPreview } from './convertPreview';
import { layoutMovementGraph } from './convertPreviewGraph';

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

describe('layoutMovementGraph', () => {
  it('dedupes accounts and orders debit column before credit', () => {
    const layout = layoutMovementGraph(previewFixture);
    const debitCodes = layout.nodes
      .filter((node) => node.column === 'debit')
      .map((node) => node.code);
    expect(debitCodes).toEqual(['5440']);
    expect(layout.nodes.some((node) => node.code === '1100')).toBe(true);
    expect(layout.edges.some((edge) => edge.kind === 'original')).toBe(true);
    expect(layout.edges.filter((edge) => edge.kind === 'step')).toHaveLength(1);
  });

  it('labels step edges with order and percent', () => {
    const layout = layoutMovementGraph(previewFixture);
    const stepEdge = layout.edges.find((edge) => edge.kind === 'step');
    expect(stepEdge?.label).toContain('#1');
    expect(stepEdge?.label).toContain('60');
  });
});
