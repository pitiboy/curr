import { useEffect, useState } from 'react';

import { fetchMembershipShareReport } from './membershipShare.fetch';
import { filterReportByFocus } from './membershipShare.helpers';
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
): MembershipShareQuery {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${focus}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<MembershipShareReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetchMembershipShareReport(preset)
      .then((data) => {
        if (!active) return;
        setReport(data ? filterReportByFocus(data, focus) : null);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(`${preset}:${focus}:${reloadToken}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'membership-share load failed',
        );
        setResolvedKey(`${preset}:${focus}:${reloadToken}`);
      });

    return () => {
      active = false;
    };
  }, [preset, focus, reloadToken]);

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
