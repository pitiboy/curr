/**
 * Test fixtures: the seeded egg form templates (edizone JSON) turned into
 * populated WorkflowTemplate rows, same mapping as
 * `database/seeders/http/common/11-transaction-workflows.http`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  STEP_MEMBER_CREDIT,
  STEP_MEMBER_DEBIT,
  STEP_RELATED,
  type WorkflowStep,
  type WorkflowTemplate,
} from '../transaction-workflow/convert.ts';
import type { EggPlanTemplates } from './plan.ts';

export const SEED_DIR = path.resolve(
  import.meta.dirname,
  '../../database/seeders/http/edizone/data/transaction-workflows',
);

export const SEED_FILES = {
  productionPool: '40-tojas-urlap-termeles-es-atvezetes.json',
  distributionInternal: '41-tojas-urlap-tovabbosztas-belso.json',
  distributionSale: '42-tojas-urlap-tovabbosztas-eladas.json',
} as const;

export const POULTRY_ORG_ID = 'org-poultry';
export const EGG = { documentId: 'cur-EGG', code: 'EGG' };
export const HUF = { documentId: 'cur-HUF', code: 'HUF' };
export const EUR = { documentId: 'cur-EUR', code: 'EUR' };

export type SeedStep = {
  description: string;
  percent: number;
  debit_code: string;
  credit_code: string;
  currency: string;
  organization?: string;
  transaction_type?: string;
  apply_currency_rate?: boolean;
};

export type SeedWorkflow = {
  name: string;
  status?: string;
  debit_account_code: string | number;
  credit_account_code: string | number;
  currency?: string;
  steps: SeedStep[];
};

export function readSeed(file: string): SeedWorkflow {
  return JSON.parse(readFileSync(path.join(SEED_DIR, file), 'utf8'));
}

export function account(code: string) {
  return { documentId: `acc-${code}`, code };
}

export function transactionTypeId(name: string) {
  return `tt-${name}`;
}

const currencies: Record<string, { documentId: string; code: string }> = {
  EGG,
  HUF,
  EUR,
};

const MEMBER_CODES = ['1101', '1001'];

export function templateFromSeed(seed: SeedWorkflow): WorkflowTemplate {
  const step: WorkflowStep[] = seed.steps.map((row) => {
    const debitMember = MEMBER_CODES.includes(row.debit_code);
    const creditMember = MEMBER_CODES.includes(row.credit_code);
    const base: WorkflowStep = {
      __component: debitMember
        ? STEP_MEMBER_DEBIT
        : creditMember
          ? STEP_MEMBER_CREDIT
          : STEP_RELATED,
      description: row.description,
      percent: row.percent,
      currency_type: currencies[row.currency],
      transaction_type: row.transaction_type
        ? { documentId: transactionTypeId(row.transaction_type) }
        : null,
      apply_currency_rate: row.apply_currency_rate === true,
    };
    if (debitMember) base.member_account_code = row.debit_code;
    else base.debit_account = account(row.debit_code);
    if (creditMember) base.member_account_code = row.credit_code;
    else base.credit_account = account(row.credit_code);
    if (row.organization === '{original.organization}') {
      base.organization_from_original = true;
    } else if (row.organization === 'Tyúktartás') {
      base.organization = { documentId: POULTRY_ORG_ID };
    }
    return base;
  });
  return {
    documentId: `wf-${seed.name}`,
    name: seed.name,
    debit_account_code: String(seed.debit_account_code),
    credit_account_code: String(seed.credit_account_code),
    step,
  };
}

export function seededTemplates(): EggPlanTemplates {
  return {
    productionPool: templateFromSeed(readSeed(SEED_FILES.productionPool)),
    distributionInternal: templateFromSeed(
      readSeed(SEED_FILES.distributionInternal),
    ),
    distributionSale: templateFromSeed(readSeed(SEED_FILES.distributionSale)),
  };
}

export function hufRate(rate: number) {
  return {
    fromCurrencyDocumentId: EGG.documentId,
    toCurrencyDocumentId: HUF.documentId,
    rate,
    validFrom: '2026-01-01T00:00:00.000Z',
    currencyRateDocumentId: 'rate-1',
    inverted: false,
  };
}
