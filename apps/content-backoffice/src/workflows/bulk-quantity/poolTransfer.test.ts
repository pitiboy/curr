import { describe, expect, it } from 'vitest';

import {
  POULTRY_STOCK_ORGANIZATION_NAME,
  buildPoolTransferLegPlans,
  poolTransferLegKey,
} from './poolTransfer';

describe('poolTransfer', () => {
  const poolRefs = {
    parentOrganizationId: 'org-parent',
    coopOutDebitAccountId: 'acc-4500',
    coopOutCreditAccountId: 'acc-1300',
    parentInDebitAccountId: 'acc-1300',
    parentInCreditAccountId: 'acc-4500',
    currencyTypeId: 'cur-egg',
    transactionTypeId: 'type-atv',
  };

  it('uses Tyúktartás as pooled stock org name', () => {
    expect(POULTRY_STOCK_ORGANIZATION_NAME).toBe('Tyúktartás');
  });

  it('builds coop-out and parent-in legs', () => {
    const plans = buildPoolTransferLegPlans({
      row: {
        organizationId: 'org-coop',
        organizationName: '2025 alom',
        amount: 12,
      },
      date: '2026-10-01',
      poolRefs,
      coopOutDescription: 'ól',
      parentInDescription: 'szülő',
      action: 'insert',
    });
    expect(plans).toHaveLength(2);
    expect(plans[0]?.legKey).toBe(poolTransferLegKey('org-coop', 'coop-out'));
    expect(plans[0]?.payload.organization).toBe('org-coop');
    expect(plans[0]?.payload).toMatchObject({
      debit_account: 'acc-4500',
      credit_account: 'acc-1300',
    });
    expect(plans[1]?.payload.organization).toBe('org-parent');
    expect(plans[1]?.payload).toMatchObject({
      debit_account: 'acc-1300',
      credit_account: 'acc-4500',
    });
  });
});
