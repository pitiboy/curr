/**
 * Napi tojás űrlap — tiszta tervezés (Strapi nélkül, tesztelhető).
 *
 * A lábakat a transaction-workflow motor pure kifejtése adja
 * (`expandWorkflowSteps`), virtuális forrás sorral: nincs storno, nincs
 * `converted_to_workflow`, nincs `entered_key` — pontosan azok a sorok
 * keletkeznek, amiket a régi kliens oldali mentés írt.
 *
 * - termelés + készlet átvezetés (ólanként): `productionPool` sablon, 3 lépés
 * - belső továbbosztás (tagonként): `distributionInternal` sablon, 1 lépés
 * - eladás (tagonként): `distributionSale` sablon, 3 lépés (edizone 24-gyel egyező)
 *
 * A tagsági `mode` (internal / sale) itt dől el; a Convert ezt nem nézi.
 */
import {
  TransactionWorkflowError,
  accountCodeString,
  expandTemplate,
  expandWorkflowSteps,
  type AccountRef,
  type AppliedRate,
  type CurrencyRef,
  type ExpandedStepRow,
  type MemberRatio,
  type SourceTransaction,
  type WorkflowTemplate,
} from '../transaction-workflow/convert';
import {
  EGG_WORKFLOW_TEMPLATE_NAMES,
  EGG_WORKFLOW_TEMPLATE_STEP_COUNT,
  KOR_TREASURY_ACCOUNT_CODE,
  MEMBER_PRIVATE_ACCOUNT_CODE,
  STEP_AMOUNT_PLACEHOLDER,
  type EggWorkflowTemplateRole,
} from './constants';
import { saleRevenueAmount } from './distribution';
import type { EggDistributionRule } from './membership-rules';

export const ERROR_TEMPLATE_INVALID = 'EGG_TEMPLATE_INVALID' as const;
export const ERROR_KOR_TREASURY_FORBIDDEN = 'KOR_TREASURY_FORBIDDEN' as const;

export type EggLegKind =
  | 'production'
  | 'pool-coop'
  | 'pool-parent'
  | 'internal'
  | 'sale-egg'
  | 'sale-cash'
  | 'sale-revenue';

const TEMPLATE_LEG_KINDS: Record<EggWorkflowTemplateRole, EggLegKind[]> = {
  productionPool: ['production', 'pool-coop', 'pool-parent'],
  distributionInternal: ['internal'],
  distributionSale: ['sale-egg', 'sale-cash', 'sale-revenue'],
};

/** Same suffixes as the old client plans (`poolTransfer.ts`, `distributionLogic.ts`). */
const LEG_KEY_SUFFIX: Record<EggLegKind, string> = {
  production: 'production',
  'pool-coop': 'pool-coop-out',
  'pool-parent': 'pool-parent-in',
  internal: 'internal',
  'sale-egg': 'egg',
  'sale-cash': 'cash',
  'sale-revenue': 'revenue',
};

export function eggLegKey(groupKey: string, kind: EggLegKind): string {
  return `${groupKey}:${LEG_KEY_SUFFIX[kind]}`;
}

export type EggProductionInput = {
  organizationId: string;
  organizationName: string;
  quantity: number;
};

export type EggDistributionInput = {
  memberId: string;
  memberName: string;
  quantity: number;
  rule: EggDistributionRule;
  /** `member.account` (1101) — only used for sibling lookup. */
  account?: AccountRef | null;
  /** `member.private_account` (1001) — debit of internal / sale EGG legs. */
  privateAccount: AccountRef | null;
  membershipDocumentId?: string | null;
  membershipName?: string | null;
};

export type EggPlanTemplates = Record<
  EggWorkflowTemplateRole,
  WorkflowTemplate
>;

export type EggLegData = {
  date: string;
  amount: number;
  description: string;
  organization: string;
  debit_account: string;
  credit_account: string;
  currency_type: string;
  transaction_type?: string;
};

export type EggLegPlan = {
  key: string;
  kind: EggLegKind;
  group: 'production' | 'distribution';
  /** Coop organization documentId (production group) or member documentId. */
  groupKey: string;
  /** Coop or member name (UI row label). */
  label: string;
  data: EggLegData;
  codes: {
    debit: string | null;
    credit: string | null;
    currency: string | null;
  };
};

export type EggPlanWarning = {
  code: 'MEMBER_PRIVATE_ACCOUNT_MISSING' | 'SALE_REVENUE_NOT_POSITIVE';
  groupKey: string;
  label: string;
  message: string;
};

export type EggPlanInput = {
  date: string;
  productions: readonly EggProductionInput[];
  distributions: readonly EggDistributionInput[];
  templates: EggPlanTemplates;
  eggCurrency: CurrencyRef;
  saleCurrency: CurrencyRef;
  /** EGG → sale currency rate on `date`; required only when a sale row exists. */
  saleRate: AppliedRate | null;
};

export type EggPlan = {
  legs: EggLegPlan[];
  warnings: EggPlanWarning[];
};

function templateInvalid(role: EggWorkflowTemplateRole, reason: string) {
  return new TransactionWorkflowError(
    `A(z) „${EGG_WORKFLOW_TEMPLATE_NAMES[role]}” workflow sablon hibás: ${reason}`,
    422,
    ERROR_TEMPLATE_INVALID,
    { template: EGG_WORKFLOW_TEMPLATE_NAMES[role], reason },
  );
}

/** Step count must match the fixed leg order of each template. */
export function assertEggTemplateShape(
  role: EggWorkflowTemplateRole,
  template: WorkflowTemplate,
): void {
  const steps = template.step ?? [];
  const expected = EGG_WORKFLOW_TEMPLATE_STEP_COUNT[role];
  if (steps.length !== expected) {
    throw templateInvalid(
      role,
      `${expected} lépés kell, a sablonban ${steps.length} van`,
    );
  }
}

/**
 * Sale template: currency-rate steps book in the configured sale currency
 * (Settings `saleCurrency` / `app.egg_sale_currency`), whatever the seed had.
 */
export function withSaleCurrency(
  template: WorkflowTemplate,
  saleCurrency: CurrencyRef,
): WorkflowTemplate {
  return {
    ...template,
    step: (template.step ?? []).map((step) =>
      step?.apply_currency_rate === true
        ? {
            ...step,
            currency_from_original: false,
            currency_type: saleCurrency,
          }
        : step,
    ),
  };
}

function formatStepAmount(amount: number): string {
  return String(amount);
}

/**
 * Step description: `{original.*}` via the engine, then `{step.amount}`.
 * Re-rendered from the template so the engine's ratio audit suffix does not
 * change the descriptions the form always wrote.
 */
export function renderStepDescription(
  template: string | null | undefined,
  source: SourceTransaction,
  stepAmount: number,
): string {
  return expandTemplate(template, source)
    .split(STEP_AMOUNT_PLACEHOLDER)
    .join(formatStepAmount(stepAmount));
}

function assertNoKorTreasury(row: ExpandedStepRow): void {
  for (const side of [row.debit_account, row.credit_account]) {
    if (accountCodeString(side) === KOR_TREASURY_ACCOUNT_CODE) {
      throw new TransactionWorkflowError(
        `A KOR pénztár (${KOR_TREASURY_ACCOUNT_CODE}) nem használható a tojás űrlapon`,
        422,
        ERROR_KOR_TREASURY_FORBIDDEN,
        { step: row.index },
      );
    }
  }
}

function legsFromExpansion(input: {
  role: EggWorkflowTemplateRole;
  template: WorkflowTemplate;
  source: SourceTransaction;
  rows: ExpandedStepRow[];
  group: EggLegPlan['group'];
  groupKey: string;
  label: string;
  currencyCodeById: ReadonlyMap<string, string>;
}): EggLegPlan[] {
  const kinds = TEMPLATE_LEG_KINDS[input.role];
  return input.rows.map((row, index) => {
    assertNoKorTreasury(row);
    const kind = kinds[index];
    if (!kind) {
      throw templateInvalid(input.role, `váratlan ${index + 1}. lépés`);
    }
    if (!row.organization?.documentId) {
      throw templateInvalid(
        input.role,
        `a(z) ${index + 1}. lépésnek nincs szervezete`,
      );
    }
    const stepTemplate = input.template.step?.[index]?.description;
    const data: EggLegData = {
      date: input.source.date,
      amount: row.amount,
      description: renderStepDescription(
        stepTemplate,
        input.source,
        row.amount,
      ),
      organization: row.organization.documentId,
      debit_account: row.debit_account.documentId,
      credit_account: row.credit_account.documentId,
      currency_type: row.currency_type.documentId,
    };
    if (row.transaction_type?.documentId) {
      data.transaction_type = row.transaction_type.documentId;
    }
    return {
      key: eggLegKey(input.groupKey, kind),
      kind,
      group: input.group,
      groupKey: input.groupKey,
      label: input.label,
      data,
      codes: {
        debit: accountCodeString(row.debit_account),
        credit: accountCodeString(row.credit_account),
        currency:
          input.currencyCodeById.get(row.currency_type.documentId) ?? null,
      },
    };
  });
}

/** Virtual source row: never stored, only feeds the engine. */
function virtualSource(input: {
  key: string;
  date: string;
  amount: number;
  description: string;
  currency: CurrencyRef;
  organizationId?: string;
}): SourceTransaction {
  return {
    documentId: `egg-production:${input.date}:${input.key}`,
    date: input.date,
    amount: input.amount,
    description: input.description,
    currency_type: {
      documentId: input.currency.documentId,
      code: input.currency.code ?? null,
    },
    organization: input.organizationId
      ? { documentId: input.organizationId }
      : null,
  };
}

/** 1001 / 1101 lookup like the old `memberAccountDocumentIdByCode`. */
function memberSiblings(member: EggDistributionInput): Map<string, AccountRef> {
  const map = new Map<string, AccountRef>();
  if (member.account?.documentId) {
    map.set('1101', member.account);
  }
  if (member.privateAccount?.documentId) {
    map.set(MEMBER_PRIVATE_ACCOUNT_CODE, member.privateAccount);
  }
  return map;
}

/**
 * Production (+ pool) legs per coop, then distribution legs per member, in
 * the same order the old form saved them.
 */
export function buildEggEntryPlan(input: EggPlanInput): EggPlan {
  const legs: EggLegPlan[] = [];
  const warnings: EggPlanWarning[] = [];
  const currencyCodeById = new Map<string, string>();
  for (const currency of [input.eggCurrency, input.saleCurrency]) {
    if (currency.code) currencyCodeById.set(currency.documentId, currency.code);
  }

  const productionTemplate = input.templates.productionPool;
  assertEggTemplateShape('productionPool', productionTemplate);
  const productionLegs: EggLegPlan[] = [];
  const poolLegs: EggLegPlan[] = [];
  for (const row of input.productions) {
    const source = virtualSource({
      key: row.organizationId,
      date: input.date,
      amount: row.quantity,
      description: row.organizationName,
      currency: input.eggCurrency,
      organizationId: row.organizationId,
    });
    const expanded = legsFromExpansion({
      role: 'productionPool',
      template: productionTemplate,
      source,
      rows: expandWorkflowSteps(productionTemplate, source, new Map()),
      group: 'production',
      groupKey: row.organizationId,
      label: row.organizationName,
      currencyCodeById,
    });
    productionLegs.push(expanded[0]!);
    poolLegs.push(...expanded.slice(1));
  }
  legs.push(...productionLegs, ...poolLegs);

  if (input.distributions.length === 0) {
    return { legs, warnings };
  }

  const internalTemplate = input.templates.distributionInternal;
  const saleTemplate = withSaleCurrency(
    input.templates.distributionSale,
    input.saleCurrency,
  );
  assertEggTemplateShape('distributionInternal', internalTemplate);
  assertEggTemplateShape('distributionSale', saleTemplate);

  for (const member of input.distributions) {
    if (!member.privateAccount?.documentId) {
      warnings.push({
        code: 'MEMBER_PRIVATE_ACCOUNT_MISSING',
        groupKey: member.memberId,
        label: member.memberName,
        message: `${member.memberName}: nincs saját (${MEMBER_PRIVATE_ACCOUNT_CODE}) számla, a továbbosztás kimarad`,
      });
      continue;
    }
    const source = virtualSource({
      key: member.memberId,
      date: input.date,
      amount: member.quantity,
      description: member.memberName,
      currency: input.eggCurrency,
    });
    const siblings = memberSiblings(member);

    if (member.rule.mode === 'internal') {
      legs.push(
        ...legsFromExpansion({
          role: 'distributionInternal',
          template: internalTemplate,
          source,
          rows: expandWorkflowSteps(internalTemplate, source, siblings),
          group: 'distribution',
          groupKey: member.memberId,
          label: member.memberName,
          currencyCodeById,
        }),
      );
      continue;
    }

    if (
      input.saleRate &&
      saleRevenueAmount(
        member.quantity,
        member.rule.ratio,
        input.saleRate.rate,
      ) <= 0
    ) {
      warnings.push({
        code: 'SALE_REVENUE_NOT_POSITIVE',
        groupKey: member.memberId,
        label: member.memberName,
        message: `${member.memberName}: az eladási összeg 0, a továbbosztás kimarad`,
      });
      continue;
    }

    const rates = new Map<string, AppliedRate>();
    if (input.saleRate) {
      rates.set(input.saleCurrency.documentId, input.saleRate);
    }
    const memberRatio: MemberRatio = {
      ratio: member.rule.ratio,
      membershipDocumentId: member.membershipDocumentId ?? null,
      membershipName: member.membershipName ?? null,
      source: 'membership',
    };
    legs.push(
      ...legsFromExpansion({
        role: 'distributionSale',
        template: saleTemplate,
        source,
        rows: expandWorkflowSteps(
          saleTemplate,
          source,
          siblings,
          rates,
          memberRatio,
        ),
        group: 'distribution',
        groupKey: member.memberId,
        label: member.memberName,
        currencyCodeById,
      }),
    );
  }

  return { legs, warnings };
}

/**
 * `related_transaction` target per leg (by leg key), mirroring
 * `src/transaction-event-anchor.ts`: the first production is the event
 * anchor (no relation), further productions and distribution legs point to
 * it, pool legs point to their own coop's production.
 */
export function relatedLegKeys(
  legs: readonly EggLegPlan[],
): Map<string, string | null> {
  const firstProduction = legs.find((leg) => leg.kind === 'production');
  const anchorKey = firstProduction?.key ?? null;
  const productionKeyByOrg = new Map<string, string>();
  for (const leg of legs) {
    if (leg.kind === 'production')
      productionKeyByOrg.set(leg.groupKey, leg.key);
  }
  const out = new Map<string, string | null>();
  for (const leg of legs) {
    if (leg.kind === 'production') {
      out.set(leg.key, leg.key === anchorKey ? null : anchorKey);
    } else if (leg.kind === 'pool-coop' || leg.kind === 'pool-parent') {
      out.set(leg.key, productionKeyByOrg.get(leg.groupKey) ?? anchorKey);
    } else {
      out.set(leg.key, anchorKey);
    }
  }
  return out;
}

// --- Duplicates ------------------------------------------------------------

/** `skip`: keep the existing row; `replace`: update it; `add`: insert anyway. */
export type EggConflictChoice = 'skip' | 'replace' | 'add';

export const EGG_CONFLICT_CHOICES: readonly EggConflictChoice[] = [
  'skip',
  'replace',
  'add',
];

export type ExistingEggTransaction = {
  documentId: string;
  amount: number;
  date: string;
  organizationId: string;
  currencyTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
};

/** Same key as the old client check: date + org + currency + debit + credit. */
export function eggDuplicateKey(row: {
  date: string;
  organization: string;
  currency_type: string;
  debit_account: string;
  credit_account: string;
}): string {
  return [
    String(row.date).slice(0, 10),
    row.organization,
    row.currency_type,
    row.debit_account,
    row.credit_account,
  ].join('|');
}

function existingKey(row: ExistingEggTransaction): string {
  return eggDuplicateKey({
    date: row.date,
    organization: row.organizationId,
    currency_type: row.currencyTypeId,
    debit_account: row.debitAccountId,
    credit_account: row.creditAccountId,
  });
}

/**
 * Pairs legs with existing rows sharing the duplicate key. Several legs can
 * share a key (e.g. two coops' pool legs on Tyúktartás, every sale revenue
 * leg); each existing row is used at most once, same amount first, so a
 * replace never overwrites one row twice.
 */
export function matchEggDuplicates(
  legs: readonly EggLegPlan[],
  existing: readonly ExistingEggTransaction[],
): Map<string, ExistingEggTransaction> {
  const pool = new Map<string, ExistingEggTransaction[]>();
  const seen = new Set<string>();
  for (const row of existing) {
    if (seen.has(row.documentId)) continue;
    seen.add(row.documentId);
    const key = existingKey(row);
    const list = pool.get(key) ?? [];
    list.push(row);
    pool.set(key, list);
  }
  const matched = new Map<string, ExistingEggTransaction>();
  const take = (
    key: string,
    predicate: (row: ExistingEggTransaction) => boolean,
  ) => {
    const list = pool.get(key);
    if (!list) return null;
    const index = list.findIndex(predicate);
    if (index < 0) return null;
    const [row] = list.splice(index, 1);
    return row ?? null;
  };
  for (const leg of legs) {
    const hit = take(
      eggDuplicateKey(leg.data),
      (row) => row.amount === leg.data.amount,
    );
    if (hit) matched.set(leg.key, hit);
  }
  for (const leg of legs) {
    if (matched.has(leg.key)) continue;
    const hit = take(eggDuplicateKey(leg.data), () => true);
    if (hit) matched.set(leg.key, hit);
  }
  return matched;
}

export type EggLegAction = 'insert' | 'update' | 'skip' | 'conflict';

export type ResolvedEggLeg = EggLegPlan & {
  action: EggLegAction;
  existing: ExistingEggTransaction | null;
  relatedLegKey: string | null;
};

/**
 * Leg actions from the duplicate match and the conflict choice
 * (`perGroup[groupKey]` overrides the global choice). A duplicate without a
 * choice is `conflict` — the write endpoint answers 409 for it.
 */
export function resolveEggLegActions(
  legs: readonly EggLegPlan[],
  duplicates: ReadonlyMap<string, ExistingEggTransaction>,
  choice?: EggConflictChoice | null,
  perGroup?: Readonly<Record<string, EggConflictChoice>> | null,
): ResolvedEggLeg[] {
  const related = relatedLegKeys(legs);
  return legs.map((leg) => {
    const existing = duplicates.get(leg.key) ?? null;
    let action: EggLegAction = 'insert';
    if (existing) {
      const effective = perGroup?.[leg.groupKey] ?? choice ?? null;
      action =
        effective === 'skip'
          ? 'skip'
          : effective === 'replace'
            ? 'update'
            : effective === 'add'
              ? 'insert'
              : 'conflict';
    }
    return {
      ...leg,
      action,
      existing,
      relatedLegKey: related.get(leg.key) ?? null,
    };
  });
}
