import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubmitGuard } from '../../submit/useSubmitGuard';

const { collectBulkQuantityDuplicates, saveHarness } = vi.hoisted(() => {
  const saveHarness = {
    resolveDuplicateLookup: () => {},
    resolvePipeline: () => {},
  };
  const collectBulkQuantityDuplicates = vi.fn(
    (
      _http: unknown,
      _url: string,
      _date: string,
      _checks: unknown[],
    ) =>
      new Promise<[]>((resolve) => {
        saveHarness.resolveDuplicateLookup = () => resolve([]);
      }),
  );
  return { collectBulkQuantityDuplicates, saveHarness };
});

vi.mock('ra-strapi', () => ({
  strapiHttpClient: () => vi.fn(),
  strapiDataProvider: () => ({}),
}));

vi.mock('../../data/dataProvider', () => ({
  publishTransaction: vi.fn(async () => undefined),
  saveTransactionDraft: vi.fn(async () => ({ data: { documentId: 'tx-1' } })),
}));

vi.mock('../../config', () => ({
  STRAPI_URL: 'http://api.test',
}));

vi.mock('./duplicateFetch', () => ({
  collectBulkQuantityDuplicates,
}));

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string) =>
      key === 'app.bulk_quantity.save' ? 'Mentés' : key,
    Toolbar: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

import { WizardToolbar } from './BulkQuantityEntryPage';

function SingleLayoutSaveHarness() {
  const saveGuard = useSubmitGuard<() => Promise<void>>({
    run: (task) => task(),
  });
  const saving = saveGuard.submitting;
  const runGuarded = (task: () => Promise<void>) => {
    saveGuard.submit(task);
  };
  const [pipelineStarts, setPipelineStarts] = useState(0);

  const handleSingleSave = () => {
    runGuarded(async () => {
      setPipelineStarts((count) => count + 1);
      await collectBulkQuantityDuplicates(
        vi.fn(),
        'http://api.test',
        '2026-11-21',
        [],
      );
      await new Promise<void>((resolve) => {
        saveHarness.resolvePipeline = resolve;
      });
    });
  };

  return (
    <>
      <span data-testid="pipeline-starts">{pipelineStarts}</span>
      <WizardToolbar
        activeStep={0}
        disabled={false}
        hasDistribution
        saving={saving}
        singleLayout
        onBack={() => {}}
        onNext={() => {}}
        onProductionOnly={() => {}}
        onSaveAll={() => {}}
        onSingleSave={handleSingleSave}
      />
    </>
  );
}

describe('BulkQuantityEntryPage single-layout save', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    saveHarness.resolveDuplicateLookup = () => {};
    saveHarness.resolvePipeline = () => {};
  });

  it('guards double Mentés: disabled while saving and one write pipeline', async () => {
    render(<SingleLayoutSaveHarness />);
    const saveButton = screen.getByRole('button', { name: 'Mentés' });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
    expect(screen.getByTestId('pipeline-starts').textContent).toBe('1');
    expect(collectBulkQuantityDuplicates).toHaveBeenCalledTimes(1);

    await act(async () => {
      saveHarness.resolveDuplicateLookup();
    });
    await act(async () => {
      saveHarness.resolvePipeline();
    });

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    expect(collectBulkQuantityDuplicates).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pipeline-starts').textContent).toBe('1');
  });
});