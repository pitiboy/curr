import fs from 'node:fs';
import path from 'node:path';

import { WORKFLOW_UID } from './convert';
import {
  korTransactionWorkflowSeeds,
  type SeedStep,
  type SeedWorkflow,
} from './seed-builders';

const ACCOUNT_UID = 'api::account.account';
const ORGANIZATION_UID = 'api::organization.organization';
const CURRENCY_UID = 'api::currency-type.currency-type';
const TRANSACTION_TYPE_UID = 'api::transaction-type.transaction-type';

type LookupStrapi = {
  documents: (uid: string) => {
    findMany: (params?: Record<string, unknown>) => Promise<
      { documentId: string; code?: string; name?: string }[]
    >;
    findOne: (params: Record<string, unknown>) => Promise<{
      documentId: string;
    } | null>;
    create: (params: { data: Record<string, unknown> }) => Promise<{
      documentId: string;
    }>;
    update: (params: {
      documentId: string;
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    publish: (params: { documentId: string }) => Promise<unknown>;
  };
  log: { info: (message: string) => void; warn: (message: string) => void };
};

async function firstAccountByCode(strapi: LookupStrapi, code: string) {
  const rows = await strapi.documents(ACCOUNT_UID).findMany({
    filters: { code: { $eq: code } },
    pagination: { pageSize: 1 },
    fields: ['documentId', 'code'],
  });
  return rows[0]?.documentId ?? null;
}

async function organizationByName(strapi: LookupStrapi, name: string) {
  const rows = await strapi.documents(ORGANIZATION_UID).findMany({
    filters: { name: { $eq: name } },
    pagination: { pageSize: 1 },
    fields: ['documentId', 'name'],
  });
  return rows[0]?.documentId ?? null;
}

async function currencyByCode(strapi: LookupStrapi, code: string) {
  const rows = await strapi.documents(CURRENCY_UID).findMany({
    filters: { code: { $eq: code } },
    pagination: { pageSize: 1 },
    fields: ['documentId', 'code'],
  });
  return rows[0]?.documentId ?? null;
}

async function transactionTypeByName(strapi: LookupStrapi, name: string) {
  const rows = await strapi.documents(TRANSACTION_TYPE_UID).findMany({
    filters: { name: { $eq: name } },
    pagination: { pageSize: 1 },
    fields: ['documentId', 'name'],
  });
  return rows[0]?.documentId ?? null;
}

async function resolveStep(
  strapi: LookupStrapi,
  step: SeedStep,
  cache: {
    accounts: Map<string, string>;
    orgs: Map<string, string>;
    currencies: Map<string, string>;
    types: Map<string, string>;
  },
) {
  const debitCode = step.debit_code;
  const creditCode = step.credit_code;
  let debitId = cache.accounts.get(debitCode);
  if (!debitId) {
    debitId = (await firstAccountByCode(strapi, debitCode)) ?? undefined;
    if (debitId) cache.accounts.set(debitCode, debitId);
  }
  let creditId = cache.accounts.get(creditCode);
  if (!creditId) {
    creditId = (await firstAccountByCode(strapi, creditCode)) ?? undefined;
    if (creditId) cache.accounts.set(creditCode, creditId);
  }

  let orgId = cache.orgs.get(step.organization);
  if (!orgId) {
    orgId = (await organizationByName(strapi, step.organization)) ?? undefined;
    if (orgId) cache.orgs.set(step.organization, orgId);
  }

  let currencyId = cache.currencies.get(step.currency);
  if (!currencyId) {
    currencyId = (await currencyByCode(strapi, step.currency)) ?? undefined;
    if (currencyId) cache.currencies.set(step.currency, currencyId);
  }

  let typeId: string | undefined;
  if (step.transaction_type) {
    typeId = cache.types.get(step.transaction_type);
    if (!typeId) {
      typeId =
        (await transactionTypeByName(strapi, step.transaction_type)) ??
        undefined;
      if (typeId) cache.types.set(step.transaction_type, typeId);
    }
  }

  if (!debitId || !creditId || !orgId || !currencyId) {
    throw new Error(
      `Missing lookup for step "${step.description}" (debit ${debitCode}, credit ${creditCode}, org ${step.organization}, currency ${step.currency})`,
    );
  }

  return {
    __component: 'workflow.step',
    description: step.description,
    percent: step.percent,
    debit_account: debitId,
    credit_account: creditId,
    currency_type: currencyId,
    organization: orgId,
    ...(typeId ? { transaction_type: typeId } : {}),
    ...(step.copy_receipt ? { copy_receipt: true } : {}),
  };
}

async function workflowExists(
  strapi: LookupStrapi,
  seed: SeedWorkflow,
): Promise<string | null> {
  const filters: Record<string, unknown> = {
    name: { $eq: seed.name },
    debit_account_code: { $eq: seed.debit_account_code },
    credit_account_code: { $eq: seed.credit_account_code },
  };
  if (seed.currency) {
    const currencyId = await currencyByCode(strapi, seed.currency);
    if (currencyId) filters.currency_type = { documentId: { $eq: currencyId } };
  }
  if (seed.transaction_type) {
    const typeId = await transactionTypeByName(strapi, seed.transaction_type);
    if (typeId) filters.transaction_type = { documentId: { $eq: typeId } };
  }

  const rows = await strapi.documents(WORKFLOW_UID).findMany({
    filters,
    pagination: { pageSize: 1 },
    fields: ['documentId', 'name'],
  });
  return rows[0]?.documentId ?? null;
}

export async function upsertTransactionWorkflowSeed(
  strapi: LookupStrapi,
  seed: SeedWorkflow,
) {
  const existing = await workflowExists(strapi, seed);
  if (existing) {
    strapi.log.info(
      `Transaction-workflow seed skipped (exists): "${seed.name}"`,
    );
    return existing;
  }

  const cache = {
    accounts: new Map<string, string>(),
    orgs: new Map<string, string>(),
    currencies: new Map<string, string>(),
    types: new Map<string, string>(),
  };

  const steps = [];
  for (const step of seed.steps) {
    steps.push(await resolveStep(strapi, step, cache));
  }

  let currencyTypeId: string | undefined;
  if (seed.currency) {
    currencyTypeId =
      (await currencyByCode(strapi, seed.currency)) ?? undefined;
    if (!currencyTypeId) {
      throw new Error(`Missing currency type ${seed.currency} for ${seed.name}`);
    }
  }

  let transactionTypeId: string | undefined;
  if (seed.transaction_type) {
    transactionTypeId =
      (await transactionTypeByName(strapi, seed.transaction_type)) ?? undefined;
    if (!transactionTypeId) {
      throw new Error(
        `Missing transaction type ${seed.transaction_type} for ${seed.name}`,
      );
    }
  }

  const created = await strapi.documents(WORKFLOW_UID).create({
    data: {
      name: seed.name,
      debit_account_code: seed.debit_account_code,
      credit_account_code: seed.credit_account_code,
      keep_original: seed.keep_original ?? true,
      steps_published: seed.steps_published ?? true,
      configuration: null,
      ...(currencyTypeId ? { currency_type: currencyTypeId } : {}),
      ...(transactionTypeId ? { transaction_type: transactionTypeId } : {}),
      step: steps,
    },
  });

  await strapi.documents(WORKFLOW_UID).publish({
    documentId: created.documentId,
  });

  strapi.log.info(
    `Created transaction-workflow "${seed.name}" (${created.documentId})`,
  );
  return created.documentId;
}

export function parseSeedWorkflowFile(filePath: string): SeedWorkflow {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as SeedWorkflow;
}

export function loadSeedWorkflowDirectory(dirPath: string): SeedWorkflow[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => parseSeedWorkflowFile(path.join(dirPath, name)));
}

export async function upsertKorTransactionWorkflowSeeds(strapi: LookupStrapi) {
  const dir = path.resolve(
    process.cwd(),
    'database/seeders/http/kor/data/transaction-workflows',
  );
  const fromFiles = loadSeedWorkflowDirectory(dir);
  const seeds =
    fromFiles.length > 0 ? fromFiles : korTransactionWorkflowSeeds();
  for (const seed of seeds) {
    await upsertTransactionWorkflowSeed(strapi, seed);
  }
}

export function resolveTransactionWorkflowSeedPath(instance: string): string {
  const normalized = instance.trim().toLowerCase();
  return path.resolve(
    process.cwd(),
    `database/seeders/http/${normalized}/data/transaction-workflows`,
  );
}

export async function upsertTransactionWorkflowSeedsFromInstance(
  strapi: LookupStrapi,
  instance: string,
) {
  if (instance.trim().toLowerCase() === 'kor') {
    await upsertKorTransactionWorkflowSeeds(strapi);
    return;
  }
  const dir = resolveTransactionWorkflowSeedPath(instance);
  const seeds = loadSeedWorkflowDirectory(dir);
  if (!seeds.length) {
    strapi.log.warn(
      `No transaction-workflow JSON seeds in ${dir} for instance "${instance}"`,
    );
    return;
  }
  for (const seed of seeds) {
    await upsertTransactionWorkflowSeed(strapi, seed);
  }
}
