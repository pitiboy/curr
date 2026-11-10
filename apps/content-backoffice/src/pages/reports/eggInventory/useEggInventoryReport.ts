import { useEffect, useState } from 'react';

import type { ReportParams } from '../../../filters/globalTransactionFilters';

import { useBackofficeConfig } from '../../../workflows/useBackofficeConfig';
import { EGG_PRODUCTION_WORKFLOW_ID } from '../../../workflows/bulk-quantity/eggDailyEntry.constants';
import { eggSaleCurrencyForWorkflow } from '../../../workflows/parseBackofficeConfig';

import { fetchEggInventoryReport } from './eggInventory.fetch';
import type { EggInventoryReport, EggInventoryStatus } from './types';

export type EggInventoryQuery = {
  status: EggInventoryStatus;
  report: EggInventoryReport | null;
  errorMessage: string | null;
  reload: () => void;
};

/** Report for the global filter range / status (see {@link ReportParams}). */
export function useEggInventoryReport(params: ReportParams): EggInventoryQuery {
  const { preset, bounds, transactionStatus, key: paramsKey } = params;
  const config = useBackofficeConfig();
  const saleCurrency = eggSaleCurrencyForWorkflow(
    config,
    EGG_PRODUCTION_WORKFLOW_ID,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${paramsKey}:${saleCurrency}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<EggInventoryReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!config.ready) {
      return () => {
        active = false;
      };
    }

    fetchEggInventoryReport(preset, {
      saleCurrency,
      transactionStatus,
      bounds,
    })
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
          err instanceof Error ? err.message : 'egg inventory load failed',
        );
        setResolvedKey(requestKey);
      });

    return () => {
      active = false;
    };
    // paramsKey covers preset, bounds and transactionStatus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken, saleCurrency, config.ready]);

  const status: EggInventoryStatus = !config.ready
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
