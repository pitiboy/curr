import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BackofficeFeatureRow } from '../backoffice-features/types';
import { handleParseVoice } from './handler';
import { LlmError, type LlmJsonClient, type LlmJsonRequest } from './llm';
import { createRateLimiter } from './rate-limit';
import {
  parseVoiceTransaction,
  type VoiceParseDeps,
  type VoiceParseRequest,
} from './service';
import { VoiceParseError, type VoiceActor } from './types';
import { transcriptNamesTreasury } from './validate';

type Row = Record<string, unknown>;

const ORGS: Row[] = [
  { documentId: 'org-a', name: 'Tojóól' },
  { documentId: 'org-b', name: 'Gyümölcsös' },
];
const ACCOUNTS: Row[] = [
  { documentId: 'acc-1000', code: '1000', name: 'Házipénztár' },
  { documentId: 'acc-1100', code: '1100', name: 'Bankszámlák számla' },
  { documentId: 'acc-5000', code: '5000', name: 'Anyagköltség' },
];
const CURRENCIES: Row[] = [
  { documentId: 'cur-huf', code: 'HUF', name: 'Forint' },
];
const MEMBERS: Row[] = [
  { documentId: 'mem-peti', name: 'Peti', identifier: 'peti' },
];
const WORKFLOWS: Row[] = [
  {
    documentId: 'wf-1',
    name: 'Anyagvásárlás készpénzből',
    debit_account_code: '5*',
    credit_account_code: '1000',
    configuration: null,
    currency_type: { code: 'HUF' },
  },
  {
    documentId: 'wf-egg',
    name: 'Tojás eladás',
    debit_account_code: '1000',
    credit_account_code: '4*',
    configuration: { feature: 'egg-production' },
    currency_type: null,
  },
];

const FEATURES: BackofficeFeatureRow[] = [
  { key: 'voice_transaction_entry', enabled: true, config: null },
  { key: 'egg-production', enabled: false, config: null },
];

/** user 1: dataentry in org-a only; user 2: controller (all orgs). */
function fakeStrapi(): VoiceParseDeps['strapi'] {
  const tables: Record<string, Row[]> = {
    'api::organization.organization': ORGS,
    'api::account.account': ACCOUNTS,
    'api::currency-type.currency-type': CURRENCIES,
    'api::member.member': MEMBERS,
    'api::transaction-workflow.transaction-workflow': WORKFLOWS,
  };
  return {
    db: {
      query: (uid: string) => ({
        findOne: async (params: Record<string, unknown>) => {
          if (uid !== 'plugin::users-permissions.user') return null;
          const where = params.where as { id?: unknown };
          return where.id === 1 ? { id: 1, organizations: [ORGS[0]] } : null;
        },
        findMany: async () => tables[uid] ?? [],
      }),
    },
  };
}

class FakeLlm implements LlmJsonClient {
  calls: LlmJsonRequest[] = [];
  output: unknown;
  constructor(output: unknown) {
    this.output = output;
  }
  async generateJson(request: LlmJsonRequest): Promise<unknown> {
    this.calls.push(request);
    if (this.output instanceof Error) throw this.output;
    return this.output;
  }
}

function validOutput(overrides: Row = {}): Row {
  return {
    date: '2026-11-17',
    amount: 5200,
    currency_type: 'cur-huf',
    debit_account: 'acc-5000',
    credit_account: 'acc-1000',
    organization: 'org-a',
    member: 'mem-peti',
    workflow: 'wf-1',
    description: 'Tápvásárlás',
    confidence: 0.9,
    low_confidence_fields: ['member'],
    warnings: [],
    ...overrides,
  };
}

function deps(
  llm: LlmJsonClient | null,
  options: { features?: BackofficeFeatureRow[]; limit?: number } = {},
): VoiceParseDeps {
  return {
    strapi: fakeStrapi(),
    loadFeatures: async () => options.features ?? FEATURES,
    llm,
    rateLimiter: createRateLimiter({
      limit: options.limit ?? 100,
      windowMs: 60_000,
    }),
    now: () => new Date('2026-11-18T10:00:00Z'),
  };
}

const DATAENTRY: VoiceActor = { userId: 1, roleType: 'dataentry' };
const CONTROLLER: VoiceActor = { userId: 2, roleType: 'controller' };

function request(
  overrides: Partial<VoiceParseRequest> = {},
): VoiceParseRequest {
  return {
    transcript: 'Tegnap ötezer-kétszáz forint táp készpénzből, Peti vette.',
    organizationId: 'org-a',
    ...overrides,
  };
}

async function rejectsWith(promise: Promise<unknown>, status: number) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof VoiceParseError);
    assert.equal(error.status, status);
    return true;
  });
}

describe('parseVoiceTransaction', () => {
  it('returns validated IDs, labels and confidence for a valid LLM output', async () => {
    const llm = new FakeLlm(validOutput());
    const result = await parseVoiceTransaction(deps(llm), DATAENTRY, request());

    assert.equal(result.date, '2026-11-17');
    assert.equal(result.amount, 5200);
    assert.equal(result.currency_type, 'cur-huf');
    assert.equal(result.debit_account, 'acc-5000');
    assert.equal(result.credit_account, 'acc-1000');
    assert.equal(result.organization, 'org-a');
    assert.equal(result.member, 'mem-peti');
    assert.equal(result.workflow, 'wf-1');
    assert.equal(result.description, 'Tápvásárlás');
    assert.equal(result.confidence, 0.9);
    assert.deepEqual(result.low_confidence_fields, ['member']);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.labels.debit_account, '5000 Anyagköltség');
    assert.equal(result.labels.member, 'Peti');

    assert.equal(llm.calls.length, 1);
    const call = llm.calls[0];
    assert.match(call.system, /Today is 2026-11-18/);
    assert.match(call.user, /ötezer-kétszáz/);
    // Context is scoped: dataentry sees only their own organization.
    assert.match(call.system, /org-a \| Tojóól/);
    assert.doesNotMatch(call.system, /org-b/);
    // Workflow behind a disabled feature flag is not offered.
    assert.match(call.system, /wf-1/);
    assert.doesNotMatch(call.system, /wf-egg/);
  });

  it('nulls unknown IDs and inaccessible organizations with Hungarian warnings', async () => {
    const llm = new FakeLlm(
      validOutput({
        currency_type: 'cur-made-up',
        debit_account: 'acc-9999',
        organization: 'org-b',
        member: 'mem-nobody',
        workflow: 'wf-egg',
        date: '2026-02-31',
        amount: -5,
        low_confidence_fields: ['debit_account', 'description', 'bogus'],
      }),
    );
    const result = await parseVoiceTransaction(deps(llm), DATAENTRY, request());

    assert.equal(result.currency_type, null);
    assert.equal(result.debit_account, null);
    assert.equal(result.organization, null);
    assert.equal(result.member, null);
    assert.equal(result.workflow, null);
    assert.equal(result.date, null);
    assert.equal(result.amount, null);
    assert.equal(result.credit_account, 'acc-1000');
    assert.deepEqual(result.low_confidence_fields, ['description']);
    assert.ok(result.warnings.length >= 7);
    assert.ok(result.warnings.some((w) => w.includes('szervezet')));
    assert.ok(result.warnings.some((w) => w.includes('tartozik számla')));
    assert.equal(result.labels.organization, undefined);
  });

  it('rejects an organization outside the user access before calling the LLM', async () => {
    const llm = new FakeLlm(validOutput());
    await rejectsWith(
      parseVoiceTransaction(
        deps(llm),
        DATAENTRY,
        request({ organizationId: 'org-b' }),
      ),
      403,
    );
    assert.equal(llm.calls.length, 0);
  });

  it('lets a controller use any organization', async () => {
    const llm = new FakeLlm(validOutput({ organization: 'org-b' }));
    const result = await parseVoiceTransaction(
      deps(llm),
      CONTROLLER,
      request({ organizationId: 'org-b' }),
    );
    assert.equal(result.organization, 'org-b');
  });

  it('drops the KOR treasury account unless explicitly dictated', async () => {
    const output = validOutput({ credit_account: 'acc-1100' });
    const implicit = await parseVoiceTransaction(
      deps(new FakeLlm(output)),
      DATAENTRY,
      request({ transcript: 'Ötezer forint táp, bankkártyával fizettem.' }),
    );
    assert.equal(implicit.credit_account, null);
    assert.ok(implicit.warnings.some((w) => w.includes('1100')));

    const explicit = await parseVoiceTransaction(
      deps(new FakeLlm(output)),
      DATAENTRY,
      request({ transcript: 'Ötezer forint táp a KÖR kincstárból.' }),
    );
    assert.equal(explicit.credit_account, 'acc-1100');
  });

  it('requires auth, the feature flag and a configured LLM', async () => {
    const llm = new FakeLlm(validOutput());
    await rejectsWith(parseVoiceTransaction(deps(llm), null, request()), 401);
    await rejectsWith(
      parseVoiceTransaction(
        deps(llm, {
          features: [
            { key: 'voice_transaction_entry', enabled: false, config: null },
          ],
        }),
        DATAENTRY,
        request(),
      ),
      403,
    );
    await rejectsWith(
      parseVoiceTransaction(deps(null), DATAENTRY, request()),
      503,
    );
    assert.equal(llm.calls.length, 0);
  });

  it('maps LLM failures to 502', async () => {
    await rejectsWith(
      parseVoiceTransaction(
        deps(new FakeLlm(new LlmError('boom'))),
        DATAENTRY,
        request(),
      ),
      502,
    );
    await rejectsWith(
      parseVoiceTransaction(deps(new FakeLlm('nope')), DATAENTRY, request()),
      502,
    );
  });

  it('rate-limits per user', async () => {
    const d = deps(new FakeLlm(validOutput()), { limit: 1 });
    await parseVoiceTransaction(d, DATAENTRY, request());
    await rejectsWith(parseVoiceTransaction(d, DATAENTRY, request()), 429);
    // Another user has their own window.
    await parseVoiceTransaction(d, CONTROLLER, request());
  });
});

describe('transcriptNamesTreasury', () => {
  it('matches the code, the word kincstár or the account name', () => {
    assert.equal(transcriptNamesTreasury('az 11 00-as számláról', 'X'), true);
    assert.equal(transcriptNamesTreasury('a kincstárból', 'X'), true);
    assert.equal(
      transcriptNamesTreasury(
        'a bankszámlák számla terhére',
        'Bankszámlák számla',
      ),
      true,
    );
    assert.equal(
      transcriptNamesTreasury('bankkártyával', 'Bankszámlák számla'),
      false,
    );
  });
});

describe('handleParseVoice', () => {
  it('logs transcript length and outcome, never the transcript', async () => {
    const lines: string[] = [];
    const log = {
      info: (m: string) => lines.push(m),
      warn: (m: string) => lines.push(m),
    };
    const base = deps(new FakeLlm(validOutput()));
    const strapi = {
      ...base.strapi,
      requestContext: {
        get: () => ({
          state: {
            auth: { strategy: { name: 'users-permissions' } },
            user: { id: 1 },
          },
        }),
      },
      db: {
        query: (uid: string) => {
          const inner = base.strapi.db.query(uid);
          return {
            ...inner,
            findOne: async (params: Record<string, unknown>) => {
              const row = await inner.findOne(params);
              return row ? { ...row, role: { type: 'dataentry' } } : null;
            },
          };
        },
      },
    };
    const transcript = 'Titkos szöveg: ötezer forint táp';
    const ctx: Record<string, unknown> & { status?: number; body?: unknown } = {
      request: { body: { transcript, organizationId: 'org-a' } },
      state: { user: { id: 1 } },
    };
    await handleParseVoice({ ...base, strapi }, log, ctx);

    assert.equal(ctx.status, 200);
    assert.equal((ctx.body as { data: { amount: number } }).data.amount, 5200);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /outcome=ok/);
    assert.match(lines[0], new RegExp(`transcriptLength=${transcript.length}`));
    assert.doesNotMatch(lines[0], /Titkos/);
  });

  it('writes the error body for a forbidden organization', async () => {
    const lines: string[] = [];
    const log = {
      info: (m: string) => lines.push(m),
      warn: (m: string) => lines.push(m),
    };
    const ctx: { status?: number; body?: unknown } & Record<string, unknown> = {
      request: { body: { transcript: '' } },
      state: { user: { id: 1 } },
    };
    const base = deps(new FakeLlm(validOutput()));
    await handleParseVoice(
      {
        ...base,
        strapi: {
          ...base.strapi,
          requestContext: { get: () => undefined },
        } as VoiceParseDeps['strapi'],
      },
      log,
      ctx,
    );
    assert.equal(ctx.status, 400);
    assert.match(lines[0], /outcome=error status=400/);
  });
});
