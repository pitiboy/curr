import { useEffect, useState } from 'react';

import type { ReportParams } from '../../../filters/globalTransactionFilters';

import { useBackofficeConfig } from '../../../workflows/useBackofficeConfig';

import { fetchHenInventoryReport } from './henInventory.fetch';
import type { HenInventoryReport, HenInventoryStatus } from './types';

export type HenInventoryQuery = {
  status: HenInventoryStatus;
  report: HenInventoryReport | null;
  errorMessage: string | null;
  reload: () => void;
};

/** Report for the global filter range / status (see {@link ReportParams}). */
export function useHenInventoryReport(params: ReportParams): HenInventoryQuery {
  const { preset, bounds, transactionStatus, key: paramsKey } = params;
  const config = useBackofficeConfig();
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${paramsKey}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<HenInventoryReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!config.ready) {
      return () => {
        active = false;
      };
    }

    fetchHenInventoryReport(preset, { transactionStatus, bounds })
      .then((data) => {
        if (!active) return;
        setReport(data);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(requestKey);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'hen inventory load failed',
        );
        setResolvedKey(requestKey);
      });

    return () => {
      active = false;
    };
    // paramsKey covers preset, bounds and transactionStatus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken, config.ready]);

  const status: HenInventoryStatus = !config.ready
    ? 'loading'
    : resolvedKey !== requestKey
      ? 'loading'
      : failed
        ? 'error'
        : report == null
          ? 'empty'
          : 'success';

  return {
    status,
    report: status === 'success' ? report : null,
    errorMessage: status === 'error' ? errorMessage : null,
    reload: () => setReloadToken((n) => n + 1),
  };
}
