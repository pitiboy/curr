import { useCallback, useEffect, useState } from 'react';
import { strapiHttpClient } from 'ra-strapi';

import { fetchReconciliationReport } from './reconciliation.fetch';
import type { ReconciliationReport } from './types';

const httpClient = strapiHttpClient({ storage: localStorage });

export function useReconciliationReport() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchReconciliationReport(httpClient);
      setReport(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'reconciliation load failed',
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { report, loading, error, refresh };
}
