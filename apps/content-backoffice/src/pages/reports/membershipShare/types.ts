/**
 * Membership-share (részjegy) report shapes.
 *
 * Future API (not wired yet): published money transactions that credit a
 * member ledger account. 1101 = részjegy (real share capital). 1001 = private
 * "pocket" ledger. Amounts stay split by currency; never summed across FX.
 */

export type DateRangePreset =
  'all' | 'thisMonth' | 'lastMonth' | 'last7' | 'thisYear';

/** Which member ledger(s) the report focuses on. */
export type LedgerFocus = 'share' | 'pocket' | 'both';

export const MEMBERSHIP_SHARE_FEATURE_ID = 'membership-share';

export const MEMBER_SHARE_ACCOUNT_CODE = '1101';
export const MEMBER_POCKET_ACCOUNT_CODE = '1001';

export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type MembershipShareKpis = {
  /** Totals for 1101, by currency. */
  shareByCurrency: CurrencyAmount[];
  /** Totals for 1001, by currency. */
  pocketByCurrency: CurrencyAmount[];
  /** Member count with any credit in range for the active focus. */
  memberCount: number;
  paymentCount: number;
};

export type MembershipMemberRow = {
  memberId: string;
  memberName: string;
  /** Amounts credited to this member's 1101, by currency. */
  shareByCurrency: CurrencyAmount[];
  /** Amounts credited to this member's 1001, by currency. */
  pocketByCurrency: CurrencyAmount[];
};

/** One time bucket for the historical “who paid when” bar chart. */
export type MembershipHistoryPoint = {
  /** ISO date or YYYY-MM bucket start. */
  period: string;
  /**
   * memberId → amounts in `historyCurrency` only (never mix FX).
   * share = 1101, pocket = 1001.
   */
  byMember: Record<string, { share: number; pocket: number }>;
};

export type MembershipShareReport = {
  kpis: MembershipShareKpis;
  byMember: MembershipMemberRow[];
  /** Currency of every history amount. */
  historyCurrency: string;
  history: MembershipHistoryPoint[];
};

export type MembershipShareStatus = 'loading' | 'success' | 'empty' | 'error';
