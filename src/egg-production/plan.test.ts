/**
 * egg-production/plan.ts: leg expansion with the seeded form templates
 * (same accounts, orgs, currencies, amounts and descriptions as the old
 * client-side save), event anchors, duplicate matching and conflict choices.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  ERROR_CURRENCY_RATE_MISSING,
  TransactionWorkflowError,
  accountCodeMatchesPattern,
} from '../transaction-workflow/convert.ts';
import {
  EGG_WORKFLOW_TEMPLATE_NAMES,
  KOR_TREASURY_ACCOUNT_CODE,
  POULTRY_STOCK_ORGANIZATION_NAME,
} from './constants.ts';
import { saleRevenueAmount } from './distribution.ts';
import {
  EGG,
  EUR,
  HUF,
  POULTRY_ORG_ID,
  SEED_DIR,
  SEED_FILES,
  account,
  hufRate,
  readSeed,
  seededTemplates,
  templateFromSeed,
  transactionTypeId,
} from './egg-fixtures.test.helper.ts';
import {
  ERROR_KOR_TREASURY_FORBIDDEN,
  ERROR_TEMPLATE_INVALID,
  buildEggEntryPlan,
  eggDuplicateKey,
  matchEggDuplicates,
  relatedLegKeys,
  resolveEggLegActions,
  type EggDistributionInput,
  type EggPlanInput,
  type ExistingEggTransaction,
} from './plan.ts';

const DATE = '2026-11-18';

const anna: EggDistributionInput = {
  memberId: 'm-anna',
  memberName: 'Anna',
  quantity: 10,
  rule: { mode: 'internal', ratio: 1 },
  account: { documentId: 'anna-1101', code: '1101' },
  privateAccount: { documentId: 'anna-1001', code: '1001' },
};

const bela: EggDistributionInput = {
  memberId: 'm-bela',
  memberName: 'Béla',
  quantity: 10,
  rule: { mode: 'sale', ratio: 0.75 },
  account: null,
  privateAccount: { documentId: 'bela-1001', code: '1001' },
};

function baseInput(overrides: Partial<EggPlanInput> = {}): EggPlanInput {
  return {
    date: DATE,
    productions: [
      { organizationId: 'org-a', organizationName: 'A ól', quantity: 120 },
      { organizationId: 'org-b', organizationName: 'B ól', quantity: 80 },
    ],
    distributions: [],
    templates: seededTemplates(),
    eggCurrency: EGG,
    saleCurrency: HUF,
    saleRate: hufRate(60),
    ...overrides,
  };
}

describe('buildEggEntryPlan — production + pool', () => {
  it('books production and the immediate pool transfer per coop (old form legs)', () => {
    const { legs, warnings } = buildEggEntryPlan(baseInput());
    assert.deepEqual(warnings, []);
    assert.deepEqual(
      legs.map((leg) => leg.key),
      [
        'org-a:production',
        'org-b:production',
        'org-a:pool-coop-out',
        'org-a:pool-parent-in',
        'org-b:pool-coop-out',
        'org-b:pool-parent-in',
      ],
    );
    const byKey = new Map(legs.map((leg) => [leg.key, leg.data]));
    const transfer = transactionTypeId('Átvezetés');
    assert.deepEqual(byKey.get('org-a:production'), {
      date: DATE,
      amount: 120,
      description: 'Napi tojás — A ól: 120 db',
      organization: 'org-a',
      debit_account: account('1300').documentId,
      credit_account: account('4500').documentId,
      currency_type: EGG.documentId,
      transaction_type: transfer,
    });
    assert.deepEqual(byKey.get('org-a:pool-coop-out'), {
      date: DATE,
      amount: 120,
      description: 'Tojás készlet átvezetés (ól) — A ól → Tyúktartás (120 db)',
      organization: 'org-a',
      debit_account: account('4500').documentId,
      credit_account: account('1300').documentId,
      currency_type: EGG.documentId,
      transaction_type: transfer,
    });
    assert.deepEqual(byKey.get('org-b:pool-parent-in'), {
      date: DATE,
      amount: 80,
      description: 'Tojás készlet átvezetés (Tyúktartás) — B ól (80 db)',
      organization: POULTRY_ORG_ID,
      debit_account: account('1300').documentId,
      credit_account: account('4500').documentId,
      currency_type: EGG.documentId,
      transaction_type: transfer,
    });
  });

  it('nets the coop 1300 to zero and pools the stock on Tyúktartás', () => {
    const { legs } = buildEggEntryPlan(baseInput());
    const net = new Map<string, number>();
    for (const leg of legs) {
      const org = leg.data.organization;
      if (leg.codes.debit === '1300')
        net.set(org, (net.get(org) ?? 0) + leg.data.amount);
      if (leg.codes.credit === '1300')
        net.set(org, (net.get(org) ?? 0) - leg.data.amount);
    }
    assert.equal(net.get('org-a'), 0);
    assert.equal(net.get('org-b'), 0);
    assert.equal(net.get(POULTRY_ORG_ID), 200);
  });
});

describe('buildEggEntryPlan — distribution', () => {
  it('internal member: one 1001 ← 1300 EGG leg on the poultry org', () => {
    const { legs } = buildEggEntryPlan(
      baseInput({ productions: [], distributions: [anna] }),
    );
    assert.equal(legs.length, 1);
    assert.equal(legs[0]!.key, 'm-anna:internal');
    assert.deepEqual(legs[0]!.data, {
      date: DATE,
      amount: 10,
      description: 'Tojás továbbosztás (belső) — Anna: 10 db',
      organization: POULTRY_ORG_ID,
      debit_account: 'anna-1001',
      credit_account: account('1300').documentId,
      currency_type: EGG.documentId,
      transaction_type: transactionTypeId('Átvezetés'),
    });
  });

  it('sale member: EGG leg + cash + revenue = qty × ratio × rate', () => {
    const { legs } = buildEggEntryPlan(
      baseInput({ productions: [], distributions: [bela] }),
    );
    assert.deepEqual(
      legs.map((leg) => leg.key),
      ['m-bela:egg', 'm-bela:cash', 'm-bela:revenue'],
    );
    const [egg, cash, revenue] = legs.map((leg) => leg.data);
    assert.deepEqual(egg, {
      date: DATE,
      amount: 10,
      description: 'Tojás eladás (tojás) — Béla: 10 db',
      organization: POULTRY_ORG_ID,
      debit_account: 'bela-1001',
      credit_account: account('1300').documentId,
      currency_type: EGG.documentId,
      transaction_type: transactionTypeId('Átvezetés'),
    });
    assert.deepEqual(cash, {
      date: DATE,
      amount: 450,
      description: 'Tojás eladás (kp befizetés) — Béla: 10 db → 450 Ft',
      organization: POULTRY_ORG_ID,
      debit_account: account('1000').documentId,
      credit_account: 'bela-1001',
      currency_type: HUF.documentId,
      transaction_type: transactionTypeId('Készpénz'),
    });
    assert.deepEqual(revenue, {
      date: DATE,
      amount: 450,
      description: 'Tojás eladás (bevétel) — Béla: 10 db → 450 Ft',
      organization: POULTRY_ORG_ID,
      debit_account: account('4000').documentId,
      credit_account: account('1000').documentId,
      currency_type: HUF.documentId,
      transaction_type: transactionTypeId('Átvezetés'),
    });
  });

  it('sale amount matches the old saleRevenueAmount rounding', () => {
    for (const [qty, ratio, rate] of [
      [7, 0.75, 61.3],
      [13, 1, 59.99],
      [3, 0.5, 33.333],
    ] as const) {
      const { legs } = buildEggEntryPlan(
        baseInput({
          productions: [],
          distributions: [
            { ...bela, quantity: qty, rule: { mode: 'sale', ratio } },
          ],
          saleRate: hufRate(rate),
        }),
      );
      assert.equal(legs[1]!.data.amount, saleRevenueAmount(qty, ratio, rate));
      assert.equal(legs[2]!.data.amount, saleRevenueAmount(qty, ratio, rate));
    }
  });

  it('uses the configured sale currency on the rate steps', () => {
    const { legs } = buildEggEntryPlan(
      baseInput({
        productions: [],
        distributions: [bela],
        saleCurrency: EUR,
        saleRate: { ...hufRate(0.2), toCurrencyDocumentId: EUR.documentId },
      }),
    );
    assert.equal(legs[0]!.data.currency_type, EGG.documentId);
    assert.equal(legs[1]!.data.currency_type, EUR.documentId);
    assert.equal(legs[2]!.data.currency_type, EUR.documentId);
    assert.equal(legs[1]!.codes.currency, 'EUR');
    assert.equal(legs[1]!.data.amount, 1.5);
  });

  it('missing sale rate → 422 CURRENCY_RATE_MISSING', () => {
    assert.throws(
      () =>
        buildEggEntryPlan(
          baseInput({ productions: [], distributions: [bela], saleRate: null }),
        ),
      (error: unknown) =>
        error instanceof TransactionWorkflowError &&
        error.status === 422 &&
        error.code === ERROR_CURRENCY_RATE_MISSING,
    );
  });

  it('skips members without 1001 or with zero revenue (warning, no legs)', () => {
    const { legs, warnings } = buildEggEntryPlan(
      baseInput({
        productions: [],
        distributions: [
          { ...anna, privateAccount: null },
          { ...bela, rule: { mode: 'sale', ratio: 0 } },
        ],
      }),
    );
    assert.equal(legs.length, 0);
    assert.deepEqual(
      warnings.map((row) => [row.code, row.groupKey]),
      [
        ['MEMBER_PRIVATE_ACCOUNT_MISSING', 'm-anna'],
        ['SALE_REVENUE_NOT_POSITIVE', 'm-bela'],
      ],
    );
  });

  it('never books on the KOR treasury (1100)', () => {
    const { legs } = buildEggEntryPlan(
      baseInput({ distributions: [anna, bela] }),
    );
    for (const leg of legs) {
      assert.notEqual(leg.codes.debit, KOR_TREASURY_ACCOUNT_CODE);
      assert.notEqual(leg.codes.credit, KOR_TREASURY_ACCOUNT_CODE);
    }
    const templates = seededTemplates();
    templates.distributionInternal.step![0]!.credit_account = account('1100');
    assert.throws(
      () =>
        buildEggEntryPlan(
          baseInput({ productions: [], distributions: [anna], templates }),
        ),
      (error: unknown) =>
        error instanceof TransactionWorkflowError &&
        error.code === ERROR_KOR_TREASURY_FORBIDDEN,
    );
  });

  it('rejects a template whose step count does not match', () => {
    const templates = seededTemplates();
    templates.productionPool.step = templates.productionPool.step!.slice(0, 2);
    assert.throws(
      () => buildEggEntryPlan(baseInput({ templates })),
      (error: unknown) =>
        error instanceof TransactionWorkflowError &&
        error.code === ERROR_TEMPLATE_INVALID,
    );
  });
});

describe('relatedLegKeys (event anchor)', () => {
  it('first production is the anchor; pool → own coop; distribution → anchor', () => {
    const { legs } = buildEggEntryPlan(
      baseInput({ distributions: [anna, bela] }),
    );
    const related = relatedLegKeys(legs);
    assert.equal(related.get('org-a:production'), null);
    assert.equal(related.get('org-b:production'), 'org-a:production');
    assert.equal(related.get('org-a:pool-coop-out'), 'org-a:production');
    assert.equal(related.get('org-b:pool-parent-in'), 'org-b:production');
    assert.equal(related.get('m-anna:internal'), 'org-a:production');
    assert.equal(related.get('m-bela:revenue'), 'org-a:production');
  });

  it('distribution without production has no anchor', () => {
    const { legs } = buildEggEntryPlan(
      baseInput({ productions: [], distributions: [anna] }),
    );
    assert.equal(relatedLegKeys(legs).get('m-anna:internal'), null);
  });
});

describe('duplicates and conflict choices', () => {
  function existingFor(
    leg: { data: Parameters<typeof eggDuplicateKey>[0] & { amount: number } },
    documentId: string,
    amount = leg.data.amount,
  ): ExistingEggTransaction {
    return {
      documentId,
      amount,
      date: leg.data.date,
      organizationId: leg.data.organization,
      currencyTypeId: leg.data.currency_type,
      debitAccountId: leg.data.debit_account,
      creditAccountId: leg.data.credit_account,
    };
  }

  it('matches each existing row once; same amount first for shared keys', () => {
    const { legs } = buildEggEntryPlan(baseInput());
    const parentA = legs.find((leg) => leg.key === 'org-a:pool-parent-in')!;
    const parentB = legs.find((leg) => leg.key === 'org-b:pool-parent-in')!;
    assert.equal(eggDuplicateKey(parentA.data), eggDuplicateKey(parentB.data));
    // Existing rows come back in an order that does not match the legs.
    const matched = matchEggDuplicates(legs, [
      existingFor(parentB, 'old-parent-b', 80),
      existingFor(parentA, 'old-parent-a', 120),
    ]);
    assert.equal(
      matched.get('org-a:pool-parent-in')?.documentId,
      'old-parent-a',
    );
    assert.equal(
      matched.get('org-b:pool-parent-in')?.documentId,
      'old-parent-b',
    );
    assert.equal(matched.has('org-a:production'), false);
  });

  it('one existing row for a shared key is not reused by a second leg', () => {
    const { legs } = buildEggEntryPlan(baseInput());
    const parentA = legs.find((leg) => leg.key === 'org-a:pool-parent-in')!;
    const matched = matchEggDuplicates(legs, [
      existingFor(parentA, 'old-parent', 5),
    ]);
    const hits = [...matched.values()].filter(
      (row) => row.documentId === 'old-parent',
    );
    assert.equal(hits.length, 1);
  });

  it('maps skip / replace / add; per-group choice overrides; no choice = conflict', () => {
    const { legs } = buildEggEntryPlan(baseInput());
    const prodA = legs.find((leg) => leg.key === 'org-a:production')!;
    const prodB = legs.find((leg) => leg.key === 'org-b:production')!;
    const matched = matchEggDuplicates(legs, [
      existingFor(prodA, 'old-a'),
      existingFor(prodB, 'old-b'),
    ]);
    const actions = (
      choice?: 'skip' | 'replace' | 'add',
      perGroup?: Record<string, 'skip' | 'replace' | 'add'>,
    ) =>
      Object.fromEntries(
        resolveEggLegActions(legs, matched, choice, perGroup)
          .filter((leg) => leg.kind === 'production')
          .map((leg) => [leg.key, leg.action]),
      );
    assert.deepEqual(actions(), {
      'org-a:production': 'conflict',
      'org-b:production': 'conflict',
    });
    assert.deepEqual(actions('skip'), {
      'org-a:production': 'skip',
      'org-b:production': 'skip',
    });
    assert.deepEqual(actions('replace', { 'org-b': 'add' }), {
      'org-a:production': 'update',
      'org-b:production': 'insert',
    });
    const resolved = resolveEggLegActions(legs, matched, 'replace');
    assert.equal(
      resolved.find((leg) => leg.key === 'org-a:pool-coop-out')?.action,
      'insert',
    );
  });
});

describe('seeded templates', () => {
  it('names and poultry org match the backend constants', () => {
    assert.equal(
      readSeed(SEED_FILES.productionPool).name,
      EGG_WORKFLOW_TEMPLATE_NAMES.productionPool,
    );
    assert.equal(
      readSeed(SEED_FILES.distributionInternal).name,
      EGG_WORKFLOW_TEMPLATE_NAMES.distributionInternal,
    );
    assert.equal(
      readSeed(SEED_FILES.distributionSale).name,
      EGG_WORKFLOW_TEMPLATE_NAMES.distributionSale,
    );
    const poultry = JSON.parse(
      readFileSync(
        path.resolve(SEED_DIR, '../../../../egg-poultry.constants.json'),
        'utf8',
      ),
    );
    assert.equal(
      poultry.poultryStockOrganizationName,
      POULTRY_STOCK_ORGANIZATION_NAME,
    );
  });

  it('are drafts whose header never matches a real account (Convert unaffected)', () => {
    for (const file of Object.values(SEED_FILES)) {
      const seed = readSeed(file);
      assert.equal(seed.status, 'draft', file);
      for (const code of ['1000', '1001', '1300', '4000', '4500', '1100']) {
        assert.equal(
          accountCodeMatchesPattern(code, seed.debit_account_code),
          false,
          `${file} debit ${code}`,
        );
      }
      for (const step of seed.steps) {
        assert.notEqual(step.debit_code, KOR_TREASURY_ACCOUNT_CODE);
        assert.notEqual(step.credit_code, KOR_TREASURY_ACCOUNT_CODE);
      }
    }
  });

  it('sale template steps align with edizone template 24 (Tojás eladás forintért)', () => {
    const sale = readSeed(SEED_FILES.distributionSale);
    const reference = readSeed('24-tojas-eladas-forint.json');
    const shape = (step: (typeof sale.steps)[number]) => ({
      debit: String(step.debit_code),
      credit: String(step.credit_code),
      currency: step.currency,
      organization: step.organization,
      type: step.transaction_type,
      rate: step.apply_currency_rate === true,
      percent: step.percent,
    });
    assert.deepEqual(sale.steps.map(shape), reference.steps.map(shape));
    assert.equal(sale.currency, reference.currency);
    // Description labels start with template 24's labels.
    sale.steps.forEach((step, index) => {
      assert.ok(
        step.description.startsWith(reference.steps[index]!.description),
      );
    });
    assert.ok(templateFromSeed(sale).step?.length === 3);
  });
});
