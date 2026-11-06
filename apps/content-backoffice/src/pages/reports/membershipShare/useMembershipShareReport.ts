import { useEffect, useState } from 'react';

import { fetchMembershipShareReport } from './membershipShare.fetch';
import { filterReportByFocus } from './membershipShare.helpers';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from '../shared/reportTransactionStatus';
import type {
  DateRangePreset,
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

export function useMembershipShareReport(
  preset: DateRangePreset,
  focus: LedgerFocus,
  transactionStatus: ReportTransactionStatusFilter = REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
): MembershipShareQuery {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${focus}:${transactionStatus}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<MembershipShareReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetchMembershipShareReport(preset, { transactionStatus })
      .then((data) => {
        if (!active) return;
        setReport(data ? filterReportByFocus(data, focus) : null);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(`${preset}:${focus}:${transactionStatus}:${reloadToken}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'membership-share load failed',
        );
        setResolvedKey(`${preset}:${focus}:${transactionStatus}:${reloadToken}`);
      });

    return () => {
      active = false;
    };
  }, [preset, focus, transactionStatus, reloadToken]);

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
