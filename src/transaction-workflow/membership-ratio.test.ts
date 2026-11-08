/**
 * Membership-ratio guard (0002 plan §5.2): server-side egg rule resolution,
 * date validity, preview warning and Convert 422.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ERROR_MEMBERSHIP_RATIO_UNSUPPORTED,
  TransactionWorkflowError,
} from './convert.ts';
import {
  MEMBERSHIP_RATIO_WARNING_PREFIX,
  assertMembershipRatioSupported,
  findUnsupportedMembershipRatios,
  membershipRatioWarning,
  membershipValidOn,
  resolveServerEggRule,
} from './membership-ratio.ts';

describe('resolveServerEggRule', () => {
  it('membership rules win over the type', () => {
    assert.deepEqual(
      resolveServerEggRule(
        { egg: { mode: 'sale', ratio: 0.5 } },
        { egg: { mode: 'sale', ratio: 1 } },
        'Vásárló',
      ),
      { mode: 'sale', ratio: 0.5 },
    );
  });

  it('falls back to type rules, then type name, then default 1', () => {
    assert.equal(
      resolveServerEggRule(null, { egg: { mode: 'sale', ratio: 0.9 } }).ratio,
      0.9,
    );
    assert.equal(resolveServerEggRule(null, null, 'Vásárló').ratio, 1);
    assert.equal(resolveServerEggRule(null, null, 'Ismeretlen').ratio, 1);
    assert.equal(resolveServerEggRule(null, null, null).ratio, 1);
  });

  it('ignores an invalid membership fragment', () => {
    assert.equal(
      resolveServerEggRule(
        { egg: { mode: 'bogus', ratio: 0.1 } },
        { egg: { mode: 'sale', ratio: 1 } },
      ).ratio,
      1,
    );
  });
});

describe('membershipValidOn', () => {
  it('is inclusive on both ends (UTC day)', () => {
    assert.equal(
      membershipValidOn('2026-11-07T12:00:00.000Z', null, '2026-11-07'),
      true,
    );
    assert.equal(
      membershipValidOn(null, '2026-11-07T00:00:00.000Z', '2026-11-07'),
      true,
    );
    assert.equal(
      membershipValidOn('2026-11-08T00:00:00.000Z', null, '2026-11-07'),
      false,
    );
    assert.equal(
      membershipValidOn(null, '2026-11-06T23:59:59.000Z', '2026-11-07'),
      false,
    );
  });
});

describe('findUnsupportedMembershipRatios', () => {
  const date = '2026-11-07';

  it('reports a valid membership with ratio ≠ 1', () => {
    const issues = findUnsupportedMembershipRatios(
      [
        {
          documentId: 'm-1',
          name: 'Tyúktartás — kedvezményes',
          rules: { egg: { mode: 'sale', ratio: 0.5 } },
          membership_type: { name: 'Vásárló', rules: null },
        },
      ],
      date,
    );
    assert.deepEqual(issues, [
      {
        membershipDocumentId: 'm-1',
        membershipName: 'Tyúktartás — kedvezményes',
        membershipTypeName: 'Vásárló',
        ratio: 0.5,
      },
    ]);
  });

  it('passes ratio 1, no memberships, and expired memberships', () => {
    assert.deepEqual(
      findUnsupportedMembershipRatios(
        [
          { documentId: 'ok', membership_type: { name: 'Vásárló' } },
          {
            documentId: 'expired',
            valid_to: '2026-01-01T00:00:00.000Z',
            rules: { egg: { mode: 'sale', ratio: 0.5 } },
          },
        ],
        date,
      ),
      [],
    );
    assert.deepEqual(findUnsupportedMembershipRatios([], date), []);
    assert.deepEqual(findUnsupportedMembershipRatios(null, date), []);
  });
});

describe('ratio warning / guard', () => {
  const issues = [
    {
      membershipDocumentId: 'm-1',
      membershipName: 'Kedvezményes',
      membershipTypeName: null,
      ratio: 0.5,
    },
  ];

  it('preview warning carries the machine code prefix', () => {
    const warning = membershipRatioWarning(issues);
    assert.ok(warning?.startsWith(MEMBERSHIP_RATIO_WARNING_PREFIX));
    assert.match(warning ?? '', /Kedvezményes \(ratio 0.5\)/);
    assert.equal(membershipRatioWarning([]), null);
  });

  it('convert guard throws 422 MEMBERSHIP_RATIO_UNSUPPORTED', () => {
    assert.throws(
      () => assertMembershipRatioSupported(issues),
      (error: unknown) =>
        error instanceof TransactionWorkflowError &&
        error.status === 422 &&
        error.code === ERROR_MEMBERSHIP_RATIO_UNSUPPORTED &&
        Array.isArray(error.details?.memberships),
    );
    assert.doesNotThrow(() => assertMembershipRatioSupported([]));
  });
});
