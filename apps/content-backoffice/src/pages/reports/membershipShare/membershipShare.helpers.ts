import type {
  CurrencyAmount,
  LedgerFocus,
  MembershipHistoryPoint,
  MembershipMemberRow,
  MembershipShareKpis,
  MembershipShareReport,
} from './types';

export function mergeCurrencyAmounts(
  ...groups: CurrencyAmount[][]
): CurrencyAmount[] {
  const map = new Map<string, number>();
  for (const group of groups) {
    for (const row of group) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
    }
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function focusCurrencyAmounts(
  row: MembershipMemberRow,
  focus: LedgerFocus,
): CurrencyAmount[] {
  const parts: CurrencyAmount[][] = [];
  if (focus === 'share' || focus === 'both') parts.push(row.shareByCurrency);
  if (focus === 'pocket' || focus === 'both') parts.push(row.pocketByCurrency);
  return mergeCurrencyAmounts(...parts);
}

/**
 * Amount for one ledger focus. Pass `currency` for display/sort — without it
 * amounts are summed across FX (legacy; do not use for visibility thresholds).
 */
export function memberFocusTotal(
  row: MembershipMemberRow,
  focus: LedgerFocus,
  currency?: string,
): number {
  const merged = focusCurrencyAmounts(row, focus);
  if (currency) {
    return merged.find((entry) => entry.currency === currency)?.amount ?? 0;
  }
  return merged.reduce((sum, entry) => sum + entry.amount, 0);
}

/** True when any single currency has a non-zero net (never sums across FX). */
export function memberHasFocusActivity(
  row: MembershipMemberRow,
  focus: LedgerFocus,
): boolean {
  return focusCurrencyAmounts(row, focus).some((entry) => entry.amount !== 0);
}

export function historyAmountForFocus(
  amounts: { share: number; pocket: number },
  focus: LedgerFocus,
): number {
  if (focus === 'share') return amounts.share;
  if (focus === 'pocket') return amounts.pocket;
  return amounts.share + amounts.pocket;
}

export function sortMembersByFocus(
  rows: MembershipMemberRow[],
  focus: LedgerFocus,
): MembershipMemberRow[] {
  const active = rows.filter((row) => memberHasFocusActivity(row, focus));
  const sortCurrency = pickHistoryCurrency(active);
  return [...active].sort(
    (a, b) =>
      memberFocusTotal(b, focus, sortCurrency) -
      memberFocusTotal(a, focus, sortCurrency),
  );
}

export function buildKpis(
  byMember: MembershipMemberRow[],
  sharePaymentCount: number,
  pocketPaymentCount: number,
  focus: LedgerFocus = 'both',
): MembershipShareKpis {
  const paymentCountForFocus =
    focus === 'both'
      ? sharePaymentCount + pocketPaymentCount
      : focus === 'share'
        ? sharePaymentCount
        : pocketPaymentCount;
  return {
    shareByCurrency: mergeCurrencyAmounts(
      ...byMember.map((row) => row.shareByCurrency),
    ),
    pocketByCurrency: mergeCurrencyAmounts(
      ...byMember.map((row) => row.pocketByCurrency),
    ),
    memberCount: byMember.filter((row) => memberHasFocusActivity(row, 'both'))
      .length,
    sharePaymentCount,
    pocketPaymentCount,
    paymentCount: paymentCountForFocus,
  };
}

function paymentCountForLedgerFocus(
  kpis: MembershipShareKpis,
  focus: LedgerFocus,
): number {
  if (focus === 'both') return kpis.sharePaymentCount + kpis.pocketPaymentCount;
  if (focus === 'share') return kpis.sharePaymentCount;
  return kpis.pocketPaymentCount;
}

function filterHistory(
  history: MembershipHistoryPoint[],
  focus: LedgerFocus,
): MembershipHistoryPoint[] {
  if (focus === 'both') return history;

  return history
    .map((point) => {
      const byMember: MembershipHistoryPoint['byMember'] = {};
      for (const [memberId, amounts] of Object.entries(point.byMember)) {
        const next = {
          share: focus === 'share' ? amounts.share : 0,
          pocket: focus === 'pocket' ? amounts.pocket : 0,
        };
        if (next.share !== 0 || next.pocket !== 0) {
          byMember[memberId] = next;
        }
      }
      return { period: point.period, byMember };
    })
    .filter((point) => Object.keys(point.byMember).length > 0);
}

/** Apply ledger focus without mutating the source report. */
export function filterReportByFocus(
  report: MembershipShareReport,
  focus: LedgerFocus,
): MembershipShareReport {
  if (focus === 'both') {
    return {
      ...report,
      byMember: sortMembersByFocus(report.byMember, focus),
      kpis: {
        ...report.kpis,
        paymentCount: paymentCountForLedgerFocus(report.kpis, 'both'),
      },
      history: report.history,
    };
  }

  const byMember = sortMembersByFocus(
    report.byMember.map((row) => ({
      ...row,
      shareByCurrency: focus === 'share' ? row.shareByCurrency : [],
      pocketByCurrency: focus === 'pocket' ? row.pocketByCurrency : [],
    })),
    focus,
  );

  return {
    kpis: {
      ...buildKpis(
        byMember,
        report.kpis.sharePaymentCount,
        report.kpis.pocketPaymentCount,
        focus,
      ),
      sharePaymentCount: report.kpis.sharePaymentCount,
      pocketPaymentCount: report.kpis.pocketPaymentCount,
      paymentCount: paymentCountForLedgerFocus(report.kpis, focus),
    },
    byMember,
    historyCurrency: report.historyCurrency,
    history: filterHistory(report.history, focus),
  };
}

/** One ledger/currency candidate before abs sizing for the pie. */
export type MembershipSharePieSliceInput = {
  id: string;
  label: string;
  /** Signed net; zero rows are dropped. */
  amount: number;
  color: string;
};

/** Pie arc uses `value` (abs); tooltip should use `signedValue`. */
export type MembershipSharePieSlice = {
  id: string;
  label: string;
  value: number;
  signedValue: number;
  color: string;
};

/**
 * Build pie slices from signed nets. Pie charts cannot size negative arcs, so
 * `value` is abs(amount); keep `signedValue` for tooltips / labels.
 */
export function buildMembershipSharePieData(
  slices: readonly MembershipSharePieSliceInput[],
): MembershipSharePieSlice[] {
  return slices
    .filter((row) => row.amount !== 0)
    .map((row) => ({
      id: row.id,
      label: row.label,
      value: Math.abs(row.amount),
      signedValue: row.amount,
      color: row.color,
    }));
}

/** Prefer HUF when present; otherwise the currency with the largest total. */
export function pickHistoryCurrency(
  byMember: readonly MembershipMemberRow[],
): string {
  const totals = new Map<string, number>();
  for (const row of byMember) {
    for (const entry of [...row.shareByCurrency, ...row.pocketByCurrency]) {
      totals.set(
        entry.currency,
        (totals.get(entry.currency) ?? 0) + entry.amount,
      );
    }
  }
  if ((totals.get('HUF') ?? 0) > 0) return 'HUF';
  let best = 'HUF';
  let bestAmt = -1;
  for (const [currency, amount] of totals) {
    if (amount > bestAmt) {
      best = currency;
      bestAmt = amount;
    }
  }
  return best;
}
