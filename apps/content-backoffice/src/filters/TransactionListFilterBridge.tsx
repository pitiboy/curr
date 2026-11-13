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
 *
 * The atom is the source of truth. Without this bridge (or if RA's
 * `transactions.listParams` store wins), the sidebar UI and the list query
 * desync — looks like a cache bug (reset / ügylet bontás "do nothing").
 */
export function TransactionListFilterBridge() {
  const [state, setState] = useGlobalTransactionFilters();
  const { filterValues, setFilters } = useListContext();
  const location = useLocation();
  const seeded = useRef(false);

  const target = useMemo(() => toListFilter(state), [state]);
  const targetKey = stableFilterKey(target);
  const listKey = stableFilterKey(filterValues ?? {});

  useEffect(() => {
    let next = target;
    let nextKey = targetKey;
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
        nextKey = stableFilterKey(next);
      }
    }
    // Re-push whenever the list drifts from the atom (stale URL / RA store).
    if (listKey === nextKey) return;
    setFilters(next, {}, false);
    // Atom + live list keys; location is read once for bookmark seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, listKey]);

  return null;
}
