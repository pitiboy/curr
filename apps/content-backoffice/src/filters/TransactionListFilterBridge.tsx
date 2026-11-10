import { useEffect, useMemo, useRef } from 'react';
import { useListContext } from 'react-admin';
import { useLocation } from 'react-router-dom';

import { filterFromListSearch } from '../data/transactionListLocation';
import {
  mergeDrilldownIntoGlobal,
  stableFilterKey,
  toListFilter,
} from './globalTransactionFilters';
import { useGlobalTransactionFilters } from './globalTransactionFiltersAtom';

/**
 * Child of the transaction `List`: pushes the global filters into the React
 * Admin list (`setFilters`). A `?filter=` URL present on mount (bookmark,
 * browser history) is merged into the atom first.
 */
export function TransactionListFilterBridge() {
  const [state, setState] = useGlobalTransactionFilters();
  const { filterValues, setFilters } = useListContext();
  const location = useLocation();
  const seeded = useRef(false);

  const target = useMemo(() => toListFilter(state), [state]);
  const targetKey = stableFilterKey(target);

  useEffect(() => {
    let next = target;
    if (!seeded.current) {
      seeded.current = true;
      const fromUrl = filterFromListSearch(location.search);
      if (
        Object.keys(fromUrl).length > 0 &&
        stableFilterKey(fromUrl) !== targetKey
      ) {
        const merged = mergeDrilldownIntoGlobal(state, fromUrl);
        setState(merged);
        next = toListFilter(merged);
      }
    }
    if (stableFilterKey(filterValues ?? {}) === stableFilterKey(next)) return;
    setFilters(next, {}, false);
    // The atom drives the list: only its (stable) key re-runs the sync. The
    // URL is read once on mount; later changes are our own setFilters echoes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  return null;
}
