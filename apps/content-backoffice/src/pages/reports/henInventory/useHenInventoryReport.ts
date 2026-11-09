import { useEffect, useState } from 'react';

import { useBackofficeConfig } from '../../../workflows/useBackofficeConfig';

import { fetchHenInventoryReport } from './henInventory.fetch';
import type {
  DateRangePreset,
  HenInventoryReport,
  HenInventoryStatus,
} from './types';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';

export type HenInventoryQuery = {
  status: HenInventoryStatus;
  report: HenInventoryReport | null;
  errorMessage: string | null;
  reload: () => void;
};

export function useHenInventoryReport(
  preset: DateRangePreset,
  transactionStatus: ReportTransactionStatusFilter = REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
): HenInventoryQuery {
  const config = useBackofficeConfig();
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${transactionStatus}:${reloadToken}`;
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

    fetchHenInventoryReport(preset, { transactionStatus })
      .then((data) => {
        if (!active) return;
        setReport(data);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(`${preset}:${transactionStatus}:${reloadToken}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'hen inventory load failed',
        );
        setResolvedKey(`${preset}:${transactionStatus}:${reloadToken}`);
      });

    return () => {
      active = false;
    };
  }, [preset, reloadToken, transactionStatus, config.ready]);

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
