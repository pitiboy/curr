/**
 * Membership-share (részjegy) report shapes.
 *
 * Source: published transactions that credit a member's 1101 (részjegy /
 * `account`) or 1001 (zseb / `private_account`) ledger, where the debit is
 * not another member ledger (excludes 1101↔1001 internals). Amounts stay
 * split by currency; never summed across FX.
 */

import type { DateRangePreset } from '../shared/reportDateRange';

export type { DateRangePreset };

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
