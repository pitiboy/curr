import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string) => key,
    useGetList: () => ({ data: [], isPending: false }),
    useGetOne: () => ({ data: undefined }),
  };
});

import { applyMenuOverride } from './globalTransactionFilters';
import { globalTransactionFiltersAtom } from './globalTransactionFiltersAtom';
import { GlobalTransactionFiltersPanel } from './GlobalTransactionFiltersPanel';

afterEach(cleanup);

function renderPanel() {
  const store = createStore();
  render(
    <Provider store={store}>
      <GlobalTransactionFiltersPanel />
    </Provider>,
  );
  return store;
}

async function chooseDatePreset(label: string) {
  await userEvent.click(
    screen.getByRole('combobox', { name: 'app.filters.date_range' }),
  );
  const listbox = await screen.findByRole('listbox');
  await userEvent.click(within(listbox).getByRole('option', { name: label }));
}

describe('GlobalTransactionFiltersPanel', () => {
  it('selects a date preset in the shared atom', async () => {
    const store = renderPanel();
    expect(store.get(globalTransactionFiltersAtom).datePreset).toBe(
      'thisMonth',
    );
    await chooseDatePreset('app.reports.range.lastMonth');
    expect(store.get(globalTransactionFiltersAtom).datePreset).toBe(
      'lastMonth',
    );
  });

  it('shows custom date fields only for the Custom period', async () => {
    const store = renderPanel();
    expect(
      screen.queryByLabelText('app.filters.date_from'),
    ).not.toBeInTheDocument();

    await chooseDatePreset('app.filters.custom_date');
    expect(store.get(globalTransactionFiltersAtom).datePreset).toBe('custom');
    expect(screen.getByLabelText('app.filters.date_from')).toBeInTheDocument();
    expect(screen.getByLabelText('app.filters.date_to')).toBeInTheDocument();
  });

  it('adds an optional filter and clears everything back to the defaults', async () => {
    const store = renderPanel();
    store.set(globalTransactionFiltersAtom, (prev) =>
      applyMenuOverride(prev, 'draft'),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'app.filters.add' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', {
        name: 'resources.transactions.fields.description',
      }),
    );
    const input = screen.getByRole('textbox', {
      name: 'resources.transactions.fields.description',
    });
    await userEvent.type(input, 'tojás{Enter}');
    expect(store.get(globalTransactionFiltersAtom).description).toBe('tojás');

    await userEvent.click(
      screen.getByRole('button', { name: 'app.filters.clear' }),
    );
    expect(store.get(globalTransactionFiltersAtom)).toEqual({
      datePreset: 'thisMonth',
      status: 'preview',
      converted_to_workflow: ['none', 'expanded'],
    });
    expect(
      screen.queryByRole('textbox', {
        name: 'resources.transactions.fields.description',
      }),
    ).toBeNull();
  });
});
