/**
 * Member ratio (0002 plan §5.2): `rules[<source currency code>]` lookup,
 * membership override → type default, validity window, ambiguity 422,
 * no name fallback, `mode` ignored.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ERROR_MEMBERSHIP_RATIO_AMBIGUOUS,
  TransactionWorkflowError,
  memberRatioDescriptionSuffix,
} from './convert.ts';
import {
  memberRuleKey,
  membershipRatioFor,
  membershipValidOn,
  resolveMemberRatio,
} from './membership-ratio.ts';

const date = '2026-11-07';

describe('memberRuleKey', () => {
  it('lower-cases and trims the currency code', () => {
    assert.equal(memberRuleKey('EGG'), 'egg');
    assert.equal(memberRuleKey(' Hour '), 'hour');
    assert.equal(memberRuleKey(''), null);
    assert.equal(memberRuleKey(null), null);
  });
});

describe('membershipRatioFor', () => {
  it('membership rule wins over the type rule', () => {
    assert.deepEqual(
      membershipRatioFor(
        {
          documentId: 'm-1',
          name: 'Kedvezményes',
          rules: { egg: { mode: 'sale', ratio: 0.5 } },
          membership_type: { name: 'Vásárló', rules: { egg: { ratio: 1 } } },
        },
        'egg',
      ),
      {
        ratio: 0.5,
        membershipDocumentId: 'm-1',
        membershipName: 'Kedvezményes',
        source: 'membership',
      },
    );
  });

  it('falls back to the type rule, named after the type when unnamed', () => {
    assert.deepEqual(
      membershipRatioFor(
        {
          documentId: 'm-2',
          membership_type: {
            name: 'Érdeklődő',
            rules: { egg: { ratio: 0.75 } },
          },
        },
        'egg',
      ),
      {
        ratio: 0.75,
        membershipDocumentId: 'm-2',
        membershipName: 'Érdeklődő',
        source: 'membership_type',
      },
    );
  });

  it('missing ratio in a present rule means 1; mode is ignored', () => {
    assert.equal(
      membershipRatioFor({ rules: { egg: { mode: 'internal' } } }, 'egg')
        ?.ratio,
      1,
    );
  });

  it('no rule for the key → null (no name fallback)', () => {
    assert.equal(
      membershipRatioFor(
        { membership_type: { name: 'Érdeklődő', rules: null } },
        'egg',
      ),
      null,
    );
    assert.equal(
      membershipRatioFor({ rules: { egg: { ratio: 0.5 } } }, 'hour'),
      null,
    );
  });

  it('invalid membership ratio falls through to the type', () => {
    assert.equal(
      membershipRatioFor(
        {
          rules: { egg: { ratio: -1 } },
          membership_type: { rules: { egg: { ratio: 0.9 } } },
        },
        'egg',
      )?.ratio,
      0.9,
    );
  });
});

describe('membershipValidOn', () => {
  it('is inclusive on both ends (UTC day)', () => {
    assert.equal(
      membershipValidOn('2026-11-07T12:00:00.000Z', null, date),
      true,
    );
    assert.equal(
      membershipValidOn(null, '2026-11-07T00:00:00.000Z', date),
      true,
    );
    assert.equal(
      membershipValidOn('2026-11-08T00:00:00.000Z', null, date),
      false,
    );
    assert.equal(
      membershipValidOn(null, '2026-11-06T23:59:59.000Z', date),
      false,
    );
  });
});

describe('resolveMemberRatio', () => {
  it('returns the single matching ratio', () => {
    assert.equal(
      resolveMemberRatio(
        [{ documentId: 'm', rules: { egg: { ratio: 0.75 } } }],
        'EGG',
        date,
      )?.ratio,
      0.75,
    );
  });

  it('null without memberships, without a rule, or without a currency code', () => {
    assert.equal(resolveMemberRatio([], 'EGG', date), null);
    assert.equal(resolveMemberRatio(null, 'EGG', date), null);
    assert.equal(
      resolveMemberRatio([{ rules: { fruit: { ratio: 0.5 } } }], 'EGG', date),
      null,
    );
    assert.equal(
      resolveMemberRatio([{ rules: { egg: { ratio: 0.5 } } }], null, date),
      null,
    );
  });

  it('ignores expired memberships', () => {
    assert.equal(
      resolveMemberRatio(
        [
          {
            documentId: 'old',
            valid_to: '2026-01-01T00:00:00.000Z',
            rules: { egg: { ratio: 0.5 } },
          },
          { documentId: 'now', rules: { egg: { ratio: 1 } } },
        ],
        'EGG',
        date,
      )?.membershipDocumentId,
      'now',
    );
  });

  it('accepts several memberships with the same ratio (any organization)', () => {
    assert.equal(
      resolveMemberRatio(
        [
          {
            documentId: 'a',
            membership_type: { rules: { egg: { ratio: 1 } } },
          },
          { documentId: 'b', rules: { egg: { ratio: 1 } } },
        ],
        'EGG',
        date,
      )?.ratio,
      1,
    );
  });

  it('different ratios → 422 MEMBERSHIP_RATIO_AMBIGUOUS', () => {
    assert.throws(
      () =>
        resolveMemberRatio(
          [
            { name: 'Tyúktartás', rules: { egg: { ratio: 1 } } },
            { name: 'Más projekt', rules: { egg: { ratio: 0.75 } } },
          ],
          'EGG',
          date,
        ),
      (error: unknown) =>
        error instanceof TransactionWorkflowError &&
        error.status === 422 &&
        error.code === ERROR_MEMBERSHIP_RATIO_AMBIGUOUS &&
        error.details?.key === 'egg',
    );
  });

  it('works for any currency key (HOUR → rules.hour)', () => {
    assert.equal(
      resolveMemberRatio([{ rules: { hour: { ratio: 0.9 } } }], 'HOUR', date)
        ?.ratio,
      0.9,
    );
  });
});

describe('memberRatioDescriptionSuffix', () => {
  it('adds ratio and membership name only when ratio ≠ 1', () => {
    assert.equal(
      memberRatioDescriptionSuffix({
        ratio: 0.75,
        membershipDocumentId: 'm',
        membershipName: 'Érdeklődő',
        source: 'membership_type',
      }),
      ' · ratio 0.75 (Érdeklődő)',
    );
    assert.equal(
      memberRatioDescriptionSuffix({
        ratio: 1,
        membershipDocumentId: 'm',
        membershipName: 'Vásárló',
        source: 'membership_type',
      }),
      '',
    );
    assert.equal(memberRatioDescriptionSuffix(null), '');
  });
});
