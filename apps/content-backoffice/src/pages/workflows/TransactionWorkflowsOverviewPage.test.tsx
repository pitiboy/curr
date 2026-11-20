import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AccountChoice } from '../../data/accountCodes';
import type { WorkflowTemplateHeader } from '../../data/transactionList';

const workflowA: WorkflowTemplateHeader = {
  documentId: 'wf-a',
  name: 'Alpha workflow',
  debit_account_code: '5410',
  credit_account_code: '1520',
  currency_type: { documentId: 'cur-huf', code: 'HUF', name: 'Forint' },
  transaction_type: null,
  requires_source_organization: false,
};

const workflowB: WorkflowTemplateHeader = {
  documentId: 'wf-b',
  name: 'Beta workflow',
  debit_account_code: '5410',
  credit_account_code: '3810',
  currency_type: { documentId: 'cur-huf', code: 'HUF', name: 'Forint' },
  transaction_type: null,
  requires_source_organization: false,
};

const accounts: AccountChoice[] = [
  { id: 'acc-debit', code: '5410', name: 'Költség' },
  { id: 'acc-credit', code: '1520', name: 'Készlet' },
  { id: 'acc-member', code: '3810', name: 'Tagi' },
];

let catalogState = {
  workflows: [workflowA, workflowB] as WorkflowTemplateHeader[],
  loading: false,
};

vi.mock('../../workflows/useTransactionWorkflowCatalog', () => ({
  useTransactionWorkflowCatalog: () => catalogState,
}));

vi.mock('../../data/accountCodes', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../data/accountCodes')>();
  return {
    ...actual,
    loadAllAccounts: vi.fn(async () => accounts),
  };
});

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string) => key,
    usePermissions: () => ({ permissions: 'editor', isPending: false }),
    useDataProvider: () => ({
      getList: vi.fn(async (resource: string) => {
        if (resource === 'organizations') {
          return { data: [], total: 0 };
        }
        return { data: accounts, total: accounts.length };
      }),
    }),
    Title: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../transactions/ConvertPreviewPanel', () => ({
  ConvertPreviewPanel: ({
    previewInput,
  }: {
    previewInput: { workflowDocumentId: string };
  }) => (
    <div data-testid={`preview-${previewInput.workflowDocumentId}`}>
      preview
    </div>
  ),
}));

import { TransactionWorkflowsOverviewPage } from './TransactionWorkflowsOverviewPage';

describe('TransactionWorkflowsOverviewPage', () => {
  afterEach(() => {
    cleanup();
    catalogState = {
      workflows: [workflowA, workflowB],
      loading: false,
    };
  });

  it('lists workflows as accordions and keeps a single expanded panel', async () => {
    const user = userEvent.setup();
    render(<TransactionWorkflowsOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha workflow')).toBeVisible();
    });
    expect(screen.getByText('Beta workflow')).toBeVisible();

    const alphaButton = screen.getByRole('button', { name: /Alpha workflow/i });
    await user.click(alphaButton);
    expect(screen.getByTestId('preview-wf-a')).toBeVisible();
    expect(screen.queryByTestId('preview-wf-b')).not.toBeInTheDocument();

    const betaButton = screen.getByRole('button', { name: /Beta workflow/i });
    await user.click(betaButton);
    expect(screen.queryByTestId('preview-wf-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-wf-b')).toBeVisible();
  });

  it('shows Strapi admin edit link when documentId is present', async () => {
    const user = userEvent.setup();
    render(<TransactionWorkflowsOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha workflow')).toBeVisible();
    });
    await user.click(screen.getByRole('button', { name: /Alpha workflow/i }));

    const edit = screen.getByRole('link', {
      name: 'app.workflow_overview.edit',
    });
    expect(edit).toHaveAttribute('href', expect.stringContaining('wf-a'));
    expect(edit).toHaveAttribute('target', '_blank');
    expect(edit).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders sample badge in expanded accordion', async () => {
    const user = userEvent.setup();
    render(<TransactionWorkflowsOverviewPage />);
    await waitFor(() => {
      expect(screen.getByText('Alpha workflow')).toBeVisible();
    });
    await user.click(screen.getByRole('button', { name: /Alpha workflow/i }));

    const details = screen.getByRole('region');
    expect(
      within(details).getByText('app.workflow_overview.sample_badge'),
    ).toBeVisible();
  });
});
