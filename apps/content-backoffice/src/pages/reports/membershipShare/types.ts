/**
 * Membership-share (részjegy) report shapes.
 *
 * Source: published transactions on a member's 1101 (részjegy / `account`) or
 * 1001 (zseb / `private_account`) ledger with the other leg outside member
 * accounts (excludes 1101↔1001 internals). Credits add, debits subtract so
 * ügylet-kifejtés zseb költségek nem duplikálnak. Debits whose credit leg is
 * 3000 (részjegytőke előírás) are not deducted — that step recognizes the
 * payment as share capital, it does not undo the befizetés. Members stay in
 * the table when any currency has a non-zero net (including negative); only
 * all-zero nets are dropped. Visibility never sums amounts across FX.
 */

import type { DateRangePreset } from '../shared/reportDateRange';

export type { DateRangePreset };

/** Which member ledger(s) the report focuses on. */
export type LedgerFocus = 'share' | 'pocket' | 'both';

export const MEMBERSHIP_SHARE_FEATURE_ID = 'membership-share';

export const MEMBER_SHARE_ACCOUNT_CODE = '1101';
export const MEMBER_POCKET_ACCOUNT_CODE = '1001';
/** Részjegytőke / alaptőke — előírás (1101←3000) nem csökkentheti a befizetés-riportot. */
export const SHARE_CAPITAL_ACCOUNT_CODE = '3000';

export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type MembershipShareKpis = {
  /** Totals for 1101, by currency. */
  shareByCurrency: CurrencyAmount[];
  /** Totals for 1001, by currency. */
  pocketByCurrency: CurrencyAmount[];
  /**
   * Members with any non-zero net currency for the active focus (positive or
   * negative). Currencies are never summed for this threshold.
   */
  memberCount: number;
  /** Credits to 1101 (részjegy) in the selected publication scope. */
  sharePaymentCount: number;
  /** Credits to 1001 (zseb) in the selected publication scope. */
  pocketPaymentCount: number;
  /**
   * Befizetések száma for the current ledger focus: share + pocket in „both”,
   * otherwise the focused leg only (matches charts and member rows).
   */
  paymentCount: number;
};

export type MembershipMemberRow = {
  memberId: string;
  memberName: string;
  /** Tagi részjegy (1101) számla documentId — drill-down. */
  shareAccountId?: string | null;
  /** Tagi zseb (1001) számla documentId — drill-down. */
  pocketAccountId?: string | null;
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
