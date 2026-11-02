import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MEMBER_ACCOUNT_KINDS,
  memberAccountName,
  missingMemberAccounts,
  payloadClearsRelation,
  payloadHasRelationTarget,
  uniqueMemberAccountName,
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

describe('uniqueMemberAccountName', () => {
  it('keeps the base name when free', () => {
    assert.equal(
      uniqueMemberAccountName('kovács.erika - tagi számla', []),
      'kovács.erika - tagi számla',
    );
  });

  it('appends (2), (3)… when the base name is taken', () => {
    assert.equal(
      uniqueMemberAccountName('kovács.erika - tagi számla', [
        'kovács.erika - tagi számla',
      ]),
      'kovács.erika - tagi számla (2)',
    );
    assert.equal(
      uniqueMemberAccountName('kovács.erika - tagi számla', [
        'kovács.erika - tagi számla',
        'kovács.erika - tagi számla (2)',
      ]),
      'kovács.erika - tagi számla (3)',
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

describe('payloadClearsRelation', () => {
  it('treats null, empty set and non-empty disconnect as a clear', () => {
    for (const value of [
      null,
      '',
      [],
      { set: [] },
      { set: null },
      { disconnect: [{ id: 1 }] },
      { connect: [], disconnect: [{ id: 1 }] },
    ]) {
      assert.equal(payloadClearsRelation(value), true, JSON.stringify(value));
    }
  });

  it('does not treat omitted fields or empty no-ops as a clear', () => {
    for (const value of [
      undefined,
      { connect: [], disconnect: [] },
      { connect: [] },
      { id: 1 },
      { connect: [{ id: 1 }] },
    ]) {
      assert.equal(payloadClearsRelation(value), false, JSON.stringify(value));
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

  it('creates both accounts on update when the stored member has none', () => {
    assert.deepEqual(
      fields(missingMemberAccounts({ name: 'x' } as never, {})),
      ['account', 'private_account'],
    );
    assert.deepEqual(
      fields(
        missingMemberAccounts({ name: 'x' } as never, {
          account: null,
          private_account: undefined,
        }),
      ),
      ['account', 'private_account'],
    );
  });

  it('treats stored relations without an id as missing', () => {
    assert.deepEqual(
      fields(
        missingMemberAccounts({ name: 'x' } as never, {
          account: { id: 1 },
          private_account: {},
        }),
      ),
      ['private_account'],
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

  it('refills when the payload disconnects a stored account', () => {
    assert.deepEqual(
      fields(
        missingMemberAccounts(
          {
            account: { disconnect: [{ id: 1 }] },
            private_account: { set: [] },
          },
          {
            account: { id: 1 },
            private_account: { id: 2 },
          },
        ),
      ),
      ['account', 'private_account'],
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
