import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MEMBER_ACCOUNT_KINDS,
  memberAccountName,
  missingMemberAccounts,
  payloadHasRelationTarget,
} from './member-accounts.ts';

const fields = (kinds: { field: string }[]) => kinds.map((kind) => kind.field);

describe('memberAccountName', () => {
  it('names both accounts after the identifier', () => {
    assert.equal(
      memberAccountName('kovács.erika', MEMBER_ACCOUNT_KINDS[0]),
      'kovács.erika - tagi számla',
    );
    assert.equal(
      memberAccountName('kovács.erika', MEMBER_ACCOUNT_KINDS[1]),
      'kovács.erika - saját számla',
    );
    assert.deepEqual(
      MEMBER_ACCOUNT_KINDS.map((kind) => kind.code),
      ['1101', '1001'],
    );
  });
});

describe('payloadHasRelationTarget', () => {
  it('accepts ids, documentIds and non-empty connect/set', () => {
    for (const value of [
      5,
      'abc',
      { id: 5 },
      { documentId: 'abc' },
      { connect: [{ id: 1 }] },
      { set: [{ id: 1 }] },
      [{ id: 1 }],
    ]) {
      assert.equal(
        payloadHasRelationTarget(value),
        true,
        JSON.stringify(value),
      );
    }
  });

  it('rejects empty, null and disconnect-only values', () => {
    for (const value of [
      undefined,
      null,
      '',
      { connect: [], disconnect: [] },
      { disconnect: [{ id: 1 }] },
      { set: [] },
      [],
    ]) {
      assert.equal(
        payloadHasRelationTarget(value),
        false,
        JSON.stringify(value),
      );
    }
  });
});

describe('missingMemberAccounts', () => {
  it('creates both for a new member', () => {
    assert.deepEqual(fields(missingMemberAccounts({}, null)), [
      'account',
      'private_account',
    ]);
  });

  it('does not recreate stored accounts on an update without relations', () => {
    assert.deepEqual(
      fields(
        missingMemberAccounts({ name: 'x' } as never, {
          account: { id: 1 },
          private_account: { id: 2 },
        }),
      ),
      [],
    );
  });

  it('adds only the private account to an existing member', () => {
    assert.deepEqual(
      fields(
        missingMemberAccounts(
          { account: { connect: [], disconnect: [] } },
          { account: { id: 1 } },
        ),
      ),
      ['private_account'],
    );
  });

  it('respects relations set in the payload', () => {
    assert.deepEqual(
      fields(
        missingMemberAccounts(
          { account: { id: 3 }, private_account: 'doc' },
          null,
        ),
      ),
      [],
    );
  });
});
