import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countFlatEntries,
  mapDocumentIdsSequentially,
  patchDocumentManagerBulkActions,
} from './content-manager-bulk-publish.ts';

describe('mapDocumentIdsSequentially', () => {
  it('awaits one document before starting the next', async () => {
    const started: string[] = [];
    const finished: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    await mapDocumentIdsSequentially(['a', 'b', 'c'], async (id) => {
      started.push(id);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      finished.push(id);
      return id;
    });

    assert.deepEqual(started, ['a', 'b', 'c']);
    assert.deepEqual(finished, ['a', 'b', 'c']);
    assert.equal(maxInFlight, 1);
  });

  it('stops on the first rejection so later ids never run', async () => {
    const seen: string[] = [];
    await assert.rejects(
      () =>
        mapDocumentIdsSequentially(['ok', 'bad', 'never'], async (id) => {
          seen.push(id);
          if (id === 'bad') {
            throw new Error('incomplete draft');
          }
          return id;
        }),
      /incomplete draft/,
    );
    assert.deepEqual(seen, ['ok', 'bad']);
  });
});

describe('countFlatEntries', () => {
  it('counts truthy entries across nested arrays', () => {
    assert.equal(countFlatEntries([[{ id: 1 }], [], [null], [{ id: 2 }]]), 2);
  });
});

describe('patchDocumentManagerBulkActions', () => {
  it('publishes inside one transaction without overlapping publishes', async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    let transactions = 0;

    const manager = {
      publish: async (documentId: string) => {
        order.push(`start:${documentId}`);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        order.push(`end:${documentId}`);
        return [{ documentId }];
      },
      publishMany: async () => 0,
      unpublishMany: async () => ({ count: 0 }),
    };

    const strapi = {
      db: {
        transaction: async <T>(cb: () => Promise<T>) => {
          transactions += 1;
          return cb();
        },
      },
      documents: () => ({
        unpublish: async () => ({ entries: [] }),
      }),
    };

    patchDocumentManagerBulkActions(manager, strapi);
    const count = await manager.publishMany('api::transaction.transaction', [
      'd1',
      'd2',
      'd3',
    ], 'hu');

    assert.equal(transactions, 1);
    assert.equal(count, 3);
    assert.equal(maxInFlight, 1);
    assert.deepEqual(order, [
      'start:d1',
      'end:d1',
      'start:d2',
      'end:d2',
      'start:d3',
      'end:d3',
    ]);
  });

  it('rolls the shared transaction back when a later publish fails', async () => {
    let rolledBack = false;
    const manager = {
      publish: async (documentId: string) => {
        if (documentId === 'bad') {
          throw new Error('Missing required fields');
        }
        return [{ documentId }];
      },
      publishMany: async () => 0,
      unpublishMany: async () => ({ count: 0 }),
    };
    const strapi = {
      db: {
        transaction: async <T>(cb: () => Promise<T>) => {
          try {
            return await cb();
          } catch (error) {
            rolledBack = true;
            throw error;
          }
        },
      },
      documents: () => ({
        unpublish: async () => ({ entries: [] }),
      }),
    };

    patchDocumentManagerBulkActions(manager, strapi);
    await assert.rejects(
      () =>
        manager.publishMany('api::transaction.transaction', ['ok', 'bad'], 'hu'),
      /Missing required fields/,
    );
    assert.equal(rolledBack, true);
  });
});
