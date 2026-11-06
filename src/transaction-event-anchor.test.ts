import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignRelatedEnteredKeys,
  poolLegRelatedDocumentId,
  productionAnchorByOrganizationId,
  submissionAnchorDocumentId,
  withRelatedTransactionDocumentId,
} from './transaction-event-anchor.ts';

describe('assignRelatedEnteredKeys', () => {
  it('links follow-up legs to production entered_key per sheet row', () => {
    const rows = assignRelatedEnteredKeys([
      { sheet_row: 5, leg: 'production', entered_key: 'egg:a' },
      { sheet_row: 5, leg: 'pool-transfer-coop', entered_key: 'egg:b' },
      { sheet_row: 5, leg: 'distribution:david', entered_key: 'egg:c' },
      { sheet_row: 6, leg: 'distribution:peti', entered_key: 'egg:d' },
    ]);
    assert.equal(rows[0]?.related_transaction_entered_key, null);
    assert.equal(rows[1]?.related_transaction_entered_key, 'egg:a');
    assert.equal(rows[2]?.related_transaction_entered_key, 'egg:a');
    assert.equal(rows[3]?.related_transaction_entered_key, null);
    assert.equal(rows[3]?.entered_key, 'egg:d');
  });
});

describe('submissionAnchorDocumentId', () => {
  it('returns the first successful documentId', () => {
    assert.equal(
      submissionAnchorDocumentId([
        { status: 'error' },
        { status: 'success', documentId: 'doc-2' },
        { status: 'success', documentId: 'doc-3' },
      ]),
      'doc-2',
    );
  });
});

describe('productionAnchorByOrganizationId', () => {
  it('maps organizationId to documentId for successes', () => {
    const map = productionAnchorByOrganizationId([
      { status: 'success', organizationId: 'org-1', documentId: 'doc-1' },
      { status: 'error', organizationId: 'org-2' },
    ]);
    assert.equal(map.get('org-1'), 'doc-1');
    assert.equal(map.has('org-2'), false);
  });
});

describe('poolLegRelatedDocumentId', () => {
  it('prefers coop production over submission anchor', () => {
    const byOrg = new Map([['org-1', 'prod-1']]);
    assert.equal(poolLegRelatedDocumentId('org-1', byOrg, 'sub-1'), 'prod-1');
    assert.equal(poolLegRelatedDocumentId('org-2', byOrg, 'sub-1'), 'sub-1');
  });
});

describe('withRelatedTransactionDocumentId', () => {
  it('adds related_transaction when anchor is set', () => {
    assert.deepEqual(
      withRelatedTransactionDocumentId({ amount: 1 }, 'anchor-1'),
      { amount: 1, related_transaction: 'anchor-1' },
    );
    assert.deepEqual(withRelatedTransactionDocumentId({ amount: 1 }, undefined), {
      amount: 1,
    });
  });
});
