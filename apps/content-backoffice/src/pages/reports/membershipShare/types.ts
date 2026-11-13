/**
 * Membership-share (részjegy) report shapes.
 *
 * Source: published transactions on a member's 1101 (részjegy / `account`) or
 * 1001 (zseb / `private_account`) ledger with the other leg outside member
 * accounts (excludes 1101↔1001 internals). Sign matches the transaction-list
 * drill-down (kifizető = credit): credit = befizetés. Debit on 1101 is kivét.
 * Debit on 1001 is zseb-kivét only for non-wash credits (e.g. 1720); ignored
 * are 3000, 5xxx projekt-wash, 1000/1100, terület-támogatás/stróman 4200/1200,
 * and 1900. KOR on 1001 is ignored; KOR 1101↔1900 is ignored so átmosás does
 * not cancel Tagi Lekötés on the share. Members stay when any currency has a
 * non-zero net (including negative). Visibility never sums amounts across FX.
 */

import type { DateRangePreset } from '../shared/reportDateRange';

export type { DateRangePreset };

/** Which member ledger(s) the report focuses on. */
export type LedgerFocus = 'share' | 'pocket' | 'both';

export const MEMBERSHIP_SHARE_FEATURE_ID = 'membership-share';

export const MEMBER_SHARE_ACCOUNT_CODE = '1101';
export const MEMBER_POCKET_ACCOUNT_CODE = '1001';
/** Részjegytőke / alaptőke — 1101↔3000 előírás/törlés nem számít a befizetés-riportban. */
export const SHARE_CAPITAL_ACCOUNT_CODE = '3000';
/** Átvezető / kincstári FX clearing — KOR kiadás erről a lábáról nem tagi nettó. */
export const TREASURY_CLEARING_ACCOUNT_CODE = '1900';
export const KOR_CURRENCY_CODE = 'KOR';

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
  /** Net Homály (1001) amounts by currency: inflows − kiadások. */
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
