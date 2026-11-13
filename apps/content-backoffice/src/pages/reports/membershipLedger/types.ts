/** Tagság kimutatás (membership ledger) report shapes. */

export const MEMBERSHIP_LEDGER_FEATURE_ID = 'membership-ledger';

export const MEMBER_SHARE_ACCOUNT_CODE = '1101';
export const MEMBER_POCKET_ACCOUNT_CODE = '1001';

/** Részjegytőke átvezetések — nem befizetés / befektetés. */
export const MEMBERSHIP_LEDGER_EQUITY_ACCOUNT_CODE = '3000';

/** Kincstár / FX clearing KOR tételek — kimutatásból kihagyva (ugyanaz mint membership-share). */
export const MEMBERSHIP_LEDGER_TREASURY_ACCOUNT_CODE = '1900';

export type MembershipLedgerMemberRow = {
  memberId: string;
  memberName: string;
  sharePayment: number;
  shareDeduction: number;
  shareBalance: number;
  pocketPayment: number;
  pocketDeduction: number;
  pocketBalance: number;
};

export type MembershipLedgerSection = {
  membershipId: string;
  membershipName: string;
  membershipTypeName: string | null;
  members: MembershipLedgerMemberRow[];
};

export type MembershipLedgerReport = {
  /** Pénznemek, amelyekhez volt mozgás a szűrt időszakban (bármely FX). */
  currencies: string[];
  /** Alapértelmezett választás (HUF ha létezik). */
  defaultCurrency: string;
  /** True if the selected currency has any payment/deduction in range. */
  hasActivity: boolean;
  sections: MembershipLedgerSection[];
};

export type MembershipLedgerStatus = 'loading' | 'success' | 'empty' | 'error';
