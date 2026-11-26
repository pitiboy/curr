import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminContext } from 'react-admin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { eggDailyEntryConfig } from './configs/eggDailyEntry.config';
import type { BulkQuantityWorkflowConfig } from './types';
import type { EggEntriesResponse } from './eggEntriesApi';

const { httpMock, notify, translate } = vi.hoisted(() => ({
  httpMock: vi.fn(),
  notify: vi.fn(),
  // Stable like react-admin's translate (effects depend on it).
  translate: (key: string, options?: { count?: number; amount?: number }) =>
    options?.count !== undefined
      ? `${key}:${options.count}`
      : options?.amount !== undefined
        ? `${key}:${options.amount}`
        : key,
}));

vi.mock('ra-strapi', () => ({ strapiHttpClient: () => httpMock }));

vi.mock('../useBackofficeConfig', () => ({
  useBackofficeConfig: () => ({
    enabled: ['egg-production'],
    available: ['egg-production'],
    publisherMustDiffer: true,
    debitCodesPattern: '/^5/',
    creditCodesPattern: '/^(1|3)/',
    appTitle: '',
    eggSaleCurrency: 'HUF',
    features: {
      'egg-production': {
        enabled: true,
        config: { saleCurrency: 'HUF', initialPublicationStatus: 'published' },
      },
    },
    ready: true,
    reload: async () => {},
  }),
}));

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useNotify: () => notify,
    useTranslate: () => translate,
  };
});

const ENTRIES = '/api/egg-production/entries';

function okResponse(): EggEntriesResponse {
  const leg = (
    key: string,
    kind: EggEntriesResponse['legs'][number]['kind'],
    groupKey: string,
    label: string,
    group: 'production' | 'distribution',
  ) => ({
    key,
    kind,
    group,
    groupKey,
    label,
    action: 'insert' as const,
    status: 'created' as const,
    published: true,
    documentId: `tx-${key}`,
    existingDocumentId: null,
    existingAmount: null,
    relatedDocumentId: null,
    amount: 120,
    description: 'x',
    debitCode: '1300',
    creditCode: '4500',
    currencyCode: 'EGG',
  });
  return {
    dryRun: false,
    date: '2026-11-18',
    autoPublish: true,
    anchorDocumentId: 'tx-org-a:production',
    legs: [
      leg('org-a:production', 'production', 'org-a', 'A ól', 'production'),
      leg('org-a:pool-coop-out', 'pool-coop', 'org-a', 'A ól', 'production'),
      leg('org-a:pool-parent-in', 'pool-parent', 'org-a', 'A ól', 'production'),
      leg('m-anna:internal', 'internal', 'm-anna', 'Anna', 'distribution'),
    ],
    conflicts: [],
    warnings: [],
  };
}

type Call = {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
};

function calls(): Call[] {
  return httpMock.mock.calls.map(([url, options]) => ({
    url: decodeURIComponent(String(url)),
    method: (options as { method?: string } | undefined)?.method ?? 'GET',
    body: (options as { body?: string } | undefined)?.body
      ? JSON.parse((options as { body: string }).body)
      : null,
  }));
}

function entryPosts(): Call[] {
  return calls().filter((call) => call.url.includes(ENTRIES));
}

let entriesHandler: (body: Record<string, unknown>) => Promise<unknown>;

beforeEach(() => {
  entriesHandler = async () => ({ json: { data: okResponse() } });
  httpMock.mockImplementation(
    async (rawUrl: string, options?: { method?: string; body?: string }) => {
      const url = decodeURIComponent(rawUrl);
      if (url.includes(ENTRIES)) {
        return entriesHandler(JSON.parse(options?.body ?? '{}'));
      }
      if (url.includes('/api/organizations') && url.includes('[parent]')) {
        return {
          json: {
            data: [
              { documentId: 'org-a', name: 'A ól' },
              { documentId: 'org-b', name: 'B ól' },
            ],
          },
        };
      }
      if (url.includes('/api/organizations')) {
        return {
          json: { data: [{ documentId: 'org-poultry', name: 'Tyúktartás' }] },
        };
      }
      if (url.includes('/api/memberships')) {
        return {
          json: {
            data: [
              {
                documentId: 'ms-1',
                valid_from: '2025-01-01T00:00:00.000Z',
                rules: { egg: { mode: 'internal', ratio: 1 } },
                membership_type: { name: 'Bentlakó tag', rules: null },
                members: [{ documentId: 'm-anna', name: 'Anna' }],
              },
            ],
          },
        };
      }
      if (url.includes('/api/currency-rates')) {
        return { json: { data: [] } };
      }
      throw new Error(`unexpected request ${url}`);
    },
  );
});

afterEach(() => {
  cleanup();
  httpMock.mockReset();
  notify.mockReset();
});

const wizardConfig = { ...eggDailyEntryConfig, layout: 'wizard' as const };

async function renderPage(config: BulkQuantityWorkflowConfig = wizardConfig) {
  const { BulkQuantityEntryPage } = await import('./BulkQuantityEntryPage');
  render(
    <AdminContext>
      <BulkQuantityEntryPage config={config} />
    </AdminContext>,
  );
  await screen.findByLabelText('A ól');
}

describe('BulkQuantityEntryPage (egg daily entry)', () => {
  it('single layout: double click on Mentés sends one POST and disables the button while saving', async () => {
    let release: () => void = () => {};
    entriesHandler = () =>
      new Promise((resolve) => {
        release = () => resolve({ json: { data: okResponse() } });
      });
    await renderPage(eggDailyEntryConfig);
    await screen.findByLabelText('Anna');
    fireEvent.change(screen.getByLabelText('A ól'), {
      target: { value: '120' },
    });
    const save = screen.getByRole('button', { name: 'app.bulk_quantity.save' });

    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(save).toBeDisabled());
    expect(entryPosts()).toHaveLength(1);

    release();
    await screen.findByTestId('bulk-quantity-results');
    expect(entryPosts()).toHaveLength(1);
  });

  it('single layout: one Save button, empty distribution sends production only', async () => {
    const user = userEvent.setup();
    await renderPage(eggDailyEntryConfig);
    expect(
      screen.queryByRole('button', {
        name: 'app.bulk_quantity.save_production_only',
      }),
    ).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Anna')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('A ól'), {
      target: { value: '120' },
    });
    await user.click(
      screen.getByRole('button', { name: 'app.bulk_quantity.save' }),
    );

    await waitFor(() => expect(entryPosts()).toHaveLength(1));
    expect(entryPosts()[0]!.body).toMatchObject({
      productions: [{ organizationId: 'org-a', quantity: 120 }],
      distributions: [],
    });
  });

  it('saves production only with a single POST and renders the per-row result', async () => {
    const user = userEvent.setup();
    await renderPage();
    fireEvent.change(screen.getByLabelText('A ól'), {
      target: { value: '120' },
    });
    await user.click(
      screen.getByRole('button', {
        name: 'app.bulk_quantity.save_production_only',
      }),
    );

    await waitFor(() => expect(entryPosts()).toHaveLength(1));
    const [post] = entryPosts();
    expect(post!.method).toBe('POST');
    expect(post!.body).toMatchObject({
      productions: [{ organizationId: 'org-a', quantity: 120 }],
      distributions: [],
      publish: true,
    });
    expect(post!.body).not.toHaveProperty('conflictChoice');
    // No client-side row writes or publishes any more.
    expect(
      calls().filter(
        (call) => call.method !== 'GET' && !call.url.includes(ENTRIES),
      ),
    ).toEqual([]);

    const results = await screen.findByTestId('bulk-quantity-results');
    expect(
      within(results).getByText(
        'A ól: app.bulk_quantity.result_created:3, app.bulk_quantity.result_published',
      ),
    ).toBeInTheDocument();
    expect(
      within(results).getByText(
        'Anna: app.bulk_quantity.result_created:1, app.bulk_quantity.result_published',
      ),
    ).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith('app.bulk_quantity.save_success', {
      type: 'success',
    });
  });

  it('sends production and distribution together from the wizard', async () => {
    const user = userEvent.setup();
    await renderPage();
    fireEvent.change(screen.getByLabelText('A ól'), {
      target: { value: '120' },
    });
    await user.click(
      screen.getByRole('button', {
        name: 'app.bulk_quantity.next_distribution',
      }),
    );
    const anna = await screen.findByLabelText('Anna');
    fireEvent.change(anna, { target: { value: '10' } });
    await user.click(
      screen.getByRole('button', {
        name: 'app.bulk_quantity.save_production_and_distribution',
      }),
    );

    await waitFor(() => expect(entryPosts()).toHaveLength(1));
    expect(entryPosts()[0]!.body).toMatchObject({
      productions: [{ organizationId: 'org-a', quantity: 120 }],
      distributions: [{ memberId: 'm-anna', quantity: 10 }],
    });
  });

  it('asks for a conflict choice on 409 and resends with it', async () => {
    const user = userEvent.setup();
    entriesHandler = async (body) => {
      if (!body.conflictChoice) {
        throw Object.assign(new Error('conflict'), {
          status: 409,
          body: {
            error: {
              status: 409,
              message: 'Már van rögzítés erre a napra.',
              details: {
                code: 'EGG_CONFLICT_CHOICE_REQUIRED',
                conflicts: [
                  {
                    key: 'org-a:production',
                    groupKey: 'org-a',
                    group: 'production',
                    label: 'A ól',
                    kind: 'production',
                    amount: 120,
                    existingDocumentId: 'old-a',
                    existingAmount: 100,
                  },
                ],
              },
            },
          },
        });
      }
      return { json: { data: okResponse() } };
    };
    await renderPage();
    fireEvent.change(screen.getByLabelText('A ól'), {
      target: { value: '120' },
    });
    await user.click(
      screen.getByRole('button', {
        name: 'app.bulk_quantity.save_production_only',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/app.bulk_quantity.conflict_existing:100/),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByLabelText('app.bulk_quantity.conflict_skip'),
    );
    await user.click(
      within(dialog).getByRole('button', {
        name: 'app.bulk_quantity.conflict_continue',
      }),
    );

    await waitFor(() => expect(entryPosts()).toHaveLength(2));
    expect(entryPosts()[1]!.body).toMatchObject({
      conflictChoice: 'skip',
      productions: [{ organizationId: 'org-a', quantity: 120 }],
    });
    expect(
      await screen.findByTestId('bulk-quantity-results'),
    ).toBeInTheDocument();
  });

  it('shows the server error and keeps the inputs when nothing was saved', async () => {
    const user = userEvent.setup();
    entriesHandler = async () => {
      throw Object.assign(new Error('boom'), {
        status: 403,
        body: {
          error: {
            status: 403,
            message: 'Nincs jogosultságod ezekre a szervezetekre: Tyúktartás',
            details: { code: 'EGG_ORG_SCOPE_DENIED' },
          },
        },
      });
    };
    await renderPage();
    fireEvent.change(screen.getByLabelText('A ól'), {
      target: { value: '120' },
    });
    await user.click(
      screen.getByRole('button', {
        name: 'app.bulk_quantity.save_production_only',
      }),
    );

    expect(
      await screen.findByText(
        /Nincs jogosultságod ezekre a szervezetekre: Tyúktartás/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('A ól')).toHaveValue(120);
    expect(entryPosts()).toHaveLength(1);
  });
});
