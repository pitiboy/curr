import { useEffect, useState } from 'react';

import type { ReportParams } from '../../../filters/globalTransactionFilters';

import { fetchMembershipShareReport } from './membershipShare.fetch';
import { filterReportByFocus } from './membershipShare.helpers';
import type {
  LedgerFocus,
  MembershipShareReport,
  MembershipShareStatus,
} from './types';

export type MembershipShareQuery = {
  status: MembershipShareStatus;
  report: MembershipShareReport | null;
  errorMessage: string | null;
  reload: () => void;
};

/** Report for the global filter range / status (see {@link ReportParams}). */
export function useMembershipShareReport(
  params: ReportParams,
  focus: LedgerFocus,
): MembershipShareQuery {
  const { preset, bounds, transactionStatus, key: paramsKey } = params;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${paramsKey}:${focus}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<MembershipShareReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetchMembershipShareReport(preset, { transactionStatus, bounds })
      .then((data) => {
        if (!active) return;
        setReport(data ? filterReportByFocus(data, focus) : null);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(requestKey);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'membership-share load failed',
        );
        setResolvedKey(requestKey);
      });

    return () => {
      active = false;
    };
    // paramsKey covers preset, bounds and transactionStatus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, focus, reloadToken]);

  const status: MembershipShareStatus =
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
