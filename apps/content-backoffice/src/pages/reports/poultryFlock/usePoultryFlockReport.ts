import { useEffect, useState } from 'react';

import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';
import { fetchPoultryFlockReport } from './poultryFlock.fetch';
import type {
  DateRangePreset,
  PoultryFlockReport,
  PoultryFlockStatus,
} from './types';

export type PoultryFlockQuery = {
  status: PoultryFlockStatus;
  report: PoultryFlockReport | null;
  reload: () => void;
};

export function usePoultryFlockReport(
  preset: DateRangePreset,
  transactionStatus: ReportTransactionStatusFilter = REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
): PoultryFlockQuery {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${transactionStatus}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<PoultryFlockReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const key = `${preset}:${transactionStatus}:${reloadToken}`;
    fetchPoultryFlockReport(preset, { transactionStatus })
      .then((data) => {
        if (!active) return;
        setReport(data);
        setFailed(false);
        setResolvedKey(key);
      })
      .catch(() => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setResolvedKey(key);
      });
    return () => {
      active = false;
    };
  }, [preset, transactionStatus, reloadToken]);

  const status: PoultryFlockStatus =
    resolvedKey !== requestKey
      ? 'loading'
      : failed
        ? 'error'
        : report == null
          ? 'empty'
          : 'success';

  return {
    status,
    report: status === 'success' ? report : null,
    reload: () => setReloadToken((n) => n + 1),
  };
}
