import { strapiHttpClient } from 'ra-strapi';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';

import { globalTransactionFiltersAtom } from '../../../filters/globalTransactionFiltersAtom';
import {
  assetReconciliationQueries,
  fetchAssetReconciliation,
} from './assetReconciliation.fetch';
import type { AssetReconciliationReport } from './types';

const httpClient = strapiHttpClient({ storage: localStorage });

export type AssetReconciliationStatus = 'loading' | 'error' | 'success';

/**
 * Same live-update mechanism as the other reports: the request key follows
 * the global sidebar filters (Jotai atom), so any filter change refetches;
 * `reload` forces a refetch (page "Frissítés" button).
 */
export function useAssetReconciliation(enabled: boolean) {
  const filters = useAtomValue(globalTransactionFiltersAtom);
  const queries = useMemo(() => assetReconciliationQueries(filters), [filters]);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${queries.key}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<AssetReconciliationReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const key = requestKey;
    fetchAssetReconciliation(httpClient, queries)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setErrorMessage(null);
        setResolvedKey(key);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setErrorMessage(
          err instanceof Error ? err.message : 'asset reconciliation failed',
        );
        setResolvedKey(key);
      });
    return () => {
      active = false;
    };
    // queries.key covers every filter the queries depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, queries.key, reloadToken]);

  const status: AssetReconciliationStatus =
    resolvedKey !== requestKey ? 'loading' : errorMessage ? 'error' : 'success';

  return {
    status,
    report: status === 'success' ? report : null,
    errorMessage: status === 'error' ? errorMessage : null,
    asOf: queries.asOf,
    reload: () => setReloadToken((n) => n + 1),
  };
}
