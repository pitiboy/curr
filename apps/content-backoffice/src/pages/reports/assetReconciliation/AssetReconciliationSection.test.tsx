import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssetReconciliationSection } from './AssetReconciliationSection';
import type {
  AssetReconciliationReport,
  AssetReconciliationTransactionMismatch,
} from './types';

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string, options?: Record<string, unknown>) =>
      options && 'count' in options ? `${key} (${options.count})` : key,
  };
});

const MISMATCH: AssetReconciliationTransactionMismatch = {
  documentId: 'tx-shovel',
  date: '2026-11-19',
  description: 'Lapát',
  currencyCode: 'HUF',
  amount: 7878,
  assetCount: 2,
  assetTotal: 15756,
  difference: 7878,
};

function report(
  partial: Partial<AssetReconciliationReport> = {},
): AssetReconciliationReport {
  return {
    rows: [
      {
        currencyCode: 'HUF',
        ledgerBalance: 15756,
        assetTotal: 15756,
        difference: 0,
        matched: true,
      },
    ],
    unlinkedAssets: [],
    unlinkedDebits: [],
    transactionMismatches: [],
    excludedTreasuryCount: 0,
    ok: true,
    ...partial,
  };
}

function renderSection(value: AssetReconciliationReport) {
  return render(
    <MemoryRouter>
      <AssetReconciliationSection
        asOf="2026-11-30"
        errorMessage={null}
        report={value}
        status="success"
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('AssetReconciliationSection – per-transaction mismatches', () => {
  it('lists the mismatching transaction with a link and the figures', () => {
    renderSection(report({ transactionMismatches: [MISMATCH], ok: false }));
    expect(
      screen.getByText(
        'app.reconciliation.fixed_assets.transaction_mismatches (1)',
      ),
    ).toBeInTheDocument();
    const table = screen.getByTestId('asset-transaction-mismatches');
    const link = within(table).getByRole('link', { name: 'Lapát' });
    expect(link).toHaveAttribute('href', '/transactions/tx-shovel/show');
    const row = link.closest('tr')!;
    expect(row).toHaveTextContent('2026-11-19');
    expect(row.textContent).toMatch(/7\s?878 HUF/);
    expect(row.textContent).toMatch(/15\s?756 HUF/);
  });

  it('flags the summary chip even when every currency matches', () => {
    renderSection(report({ transactionMismatches: [MISMATCH], ok: false }));
    expect(
      screen.getByText('app.reconciliation.fixed_assets.mismatch'),
    ).toBeInTheDocument();
  });

  it('shows the empty-section note when nothing is off', () => {
    renderSection(report());
    expect(
      screen.queryByTestId('asset-transaction-mismatches'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'app.reconciliation.fixed_assets.transaction_mismatches (0)',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('app.reconciliation.fixed_assets.ok'),
    ).toBeInTheDocument();
  });
});
