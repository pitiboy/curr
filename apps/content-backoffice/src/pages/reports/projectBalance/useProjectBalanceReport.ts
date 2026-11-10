import { useEffect, useState } from 'react';

import { useAccountCodePatterns } from '../../../workflows/useAccountCodePatterns';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';
import type { DateRangePreset } from '../shared/reportDateRange';

import { fetchProjectBalanceReport } from './projectBalance.fetch';
import type { ProjectBalanceReport, ProjectBalanceStatus } from './types';

export type ProjectBalanceQuery = {
  status: ProjectBalanceStatus;
  report: ProjectBalanceReport | null;
  errorMessage: string | null;
  reload: () => void;
};

export function useProjectBalanceReport(
  preset: DateRangePreset,
  transactionStatus: ReportTransactionStatusFilter = REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  organizationId: string | null = null,
): ProjectBalanceQuery {
  const patterns = useAccountCodePatterns();
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${transactionStatus}:${organizationId ?? ''}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<ProjectBalanceReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const key = `${preset}:${transactionStatus}:${organizationId ?? ''}:${reloadToken}`;

    fetchProjectBalanceReport(preset, {
      patterns,
      transactionStatus,
      organizationId,
    })
      .then((data) => {
        if (!active) return;
        setReport(data);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(key);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'project-balance load failed',
        );
        setResolvedKey(key);
      });

    return () => {
      active = false;
    };
  }, [preset, transactionStatus, organizationId, patterns, reloadToken]);

  const status: ProjectBalanceStatus =
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
    errorMessage: status === 'error' ? errorMessage : null,
    reload: () => setReloadToken((n) => n + 1),
  };
}
