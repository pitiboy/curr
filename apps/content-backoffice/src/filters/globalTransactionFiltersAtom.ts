import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { filterFromListSearch } from '../data/transactionListLocation';
import {
  applyMenuOverride,
  mergeDrilldownIntoGlobal,
  resetGlobalFilters,
  toReportParams,
  type GlobalTransactionFilters,
  type ReportParams,
  type TransactionMenuMode,
} from './globalTransactionFilters';

/** Session-wide transaction filters (sidebar panel → list + reports). */
export const globalTransactionFiltersAtom =
  atom<GlobalTransactionFilters>(resetGlobalFilters());

export function useGlobalTransactionFilters() {
  return useAtom(globalTransactionFiltersAtom);
}

/** Report fetch inputs; recomputed only when the filters change. */
export function useGlobalReportParams(): ReportParams {
  const state = useAtomValue(globalTransactionFiltersAtom);
  return useMemo(() => toReportParams(state), [state]);
}

/**
 * Tranzakciók / Véglegesítés: override status + converted only. The menu
 * link itself navigates to `/transactions`.
 */
export function useApplyMenuOverride() {
  const setFilters = useSetAtom(globalTransactionFiltersAtom);
  return useCallback(
    (mode: TransactionMenuMode) =>
      setFilters((prev) => applyMenuOverride(prev, mode)),
    [setFilters],
  );
}

export type TransactionListLink = {
  pathname: '/transactions';
  search: string;
};

/** Report drill-down: merge the link's filter into the atom, then the list. */
export function useOpenDrilldown() {
  const setFilters = useSetAtom(globalTransactionFiltersAtom);
  const navigate = useNavigate();
  return useCallback(
    (link: TransactionListLink) => {
      const filter = filterFromListSearch(link.search);
      setFilters((prev) => mergeDrilldownIntoGlobal(prev, filter));
      navigate(link.pathname);
    },
    [navigate, setFilters],
  );
}
