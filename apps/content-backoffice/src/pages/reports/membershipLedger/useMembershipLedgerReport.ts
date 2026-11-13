import { useEffect, useState } from 'react';

import type { ReportParams } from '../../../filters/globalTransactionFilters';

import {
  aggregateMembershipLedgerForCurrency,
  fetchMembershipLedgerData,
  type MembershipLedgerLoaded,
} from './membershipLedger.fetch';
import type { MembershipLedgerReport, MembershipLedgerStatus } from './types';

export type MembershipLedgerQuery = {
  status: MembershipLedgerStatus;
  report: MembershipLedgerReport | null;
  loaded: MembershipLedgerLoaded | null;
  errorMessage: string | null;
  reload: () => void;
};

export function useMembershipLedgerReport(
  params: ReportParams,
  currency: string,
): MembershipLedgerQuery {
  const { preset, bounds, transactionStatus, key: paramsKey } = params;
  const [reloadToken, setReloadToken] = useState(0);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<MembershipLedgerLoaded | null>(null);
  const [report, setReport] = useState<MembershipLedgerReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const fetchKey = `${paramsKey}:${reloadToken}`;

  useEffect(() => {
    let active = true;

    fetchMembershipLedgerData(preset, { transactionStatus, bounds })
      .then((data) => {
        if (!active) return;
        setLoaded(data);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(fetchKey);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoaded(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'membership-ledger load failed',
        );
        setResolvedKey(fetchKey);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  useEffect(() => {
    if (!loaded) {
      setReport(null);
      return;
    }
    setReport(aggregateMembershipLedgerForCurrency(loaded, currency));
  }, [loaded, currency]);

  const status: MembershipLedgerStatus =
    resolvedKey !== fetchKey
      ? 'loading'
      : failed
        ? 'error'
        : report == null
          ? 'empty'
          : 'success';

  return {
    status,
    report: status === 'success' ? report : null,
    loaded: status === 'success' || status === 'empty' ? loaded : loaded,
    errorMessage: status === 'error' ? errorMessage : null,
    reload: () => setReloadToken((n) => n + 1),
  };
}
