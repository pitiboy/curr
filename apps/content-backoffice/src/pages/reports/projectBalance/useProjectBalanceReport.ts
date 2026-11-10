import { useEffect, useState } from 'react';

import type { ReportParams } from '../../../filters/globalTransactionFilters';

import { useAccountCodePatterns } from '../../../workflows/useAccountCodePatterns';

import { fetchProjectBalanceReport } from './projectBalance.fetch';
import type { ProjectBalanceReport, ProjectBalanceStatus } from './types';

export type ProjectBalanceQuery = {
  status: ProjectBalanceStatus;
  report: ProjectBalanceReport | null;
  errorMessage: string | null;
  reload: () => void;
};

/** Report for the global filter range / status (see {@link ReportParams}). */
export function useProjectBalanceReport(
  params: ReportParams,
  organizationId: string | null = null,
): ProjectBalanceQuery {
  const { preset, bounds, transactionStatus, key: paramsKey } = params;
  const patterns = useAccountCodePatterns();
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${paramsKey}:${organizationId ?? ''}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<ProjectBalanceReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const key = requestKey;

    fetchProjectBalanceReport(preset, {
      patterns,
      transactionStatus,
      organizationId,
      bounds,
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
    // paramsKey covers preset, bounds and transactionStatus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, organizationId, patterns, reloadToken]);

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
