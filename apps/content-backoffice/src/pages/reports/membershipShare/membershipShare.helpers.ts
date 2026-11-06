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

export function memberFocusTotal(
  row: MembershipMemberRow,
  focus: LedgerFocus,
  currency?: string,
): number {
  const parts: CurrencyAmount[][] = [];
  if (focus === 'share' || focus === 'both') parts.push(row.shareByCurrency);
  if (focus === 'pocket' || focus === 'both') parts.push(row.pocketByCurrency);
  const merged = mergeCurrencyAmounts(...parts);
  if (currency) {
    return merged.find((entry) => entry.currency === currency)?.amount ?? 0;
  }
  return merged.reduce((sum, entry) => sum + entry.amount, 0);
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
  return [...rows]
    .filter((row) => memberFocusTotal(row, focus) > 0)
    .sort((a, b) => memberFocusTotal(b, focus) - memberFocusTotal(a, focus));
}

export function buildKpis(
  byMember: MembershipMemberRow[],
  paymentCount: number,
): MembershipShareKpis {
  return {
    shareByCurrency: mergeCurrencyAmounts(
      ...byMember.map((row) => row.shareByCurrency),
    ),
    pocketByCurrency: mergeCurrencyAmounts(
      ...byMember.map((row) => row.pocketByCurrency),
    ),
    memberCount: byMember.filter((row) => memberFocusTotal(row, 'both') > 0)
      .length,
    paymentCount,
  };
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
        if (next.share > 0 || next.pocket > 0) {
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
      ...buildKpis(byMember, report.kpis.paymentCount),
      paymentCount: report.kpis.paymentCount,
    },
    byMember,
    historyCurrency: report.historyCurrency,
    history: filterHistory(report.history, focus),
  };
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
