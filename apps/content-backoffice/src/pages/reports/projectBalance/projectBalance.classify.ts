import {
  DEFAULT_ACCOUNT_CODE_PATTERNS,
  isCreditCode,
  isDebitCode,
  normalizeAccountCode,
  type AccountCodePatterns,
} from '../../../data/accountCodes';

export type LedgerMovementKind = 'cost' | 'revenue';

const REVENUE_CREDIT = /^4/;
/** Megítélt követelés (pl. agrár támogatás megítélés sora, kifejtés előtt). */
const RECEIVABLE_DEBIT = /^12/;
/** Kincstár / belső fedezet (ügylet lánc). */
const TREASURY_LEG = /^19/;
/** Projekthez kötött állóeszköz (ingatlan, beruházás). */
const CAPEX_DEBIT = /^15/;

function isFundingLeg(code: string, patterns: AccountCodePatterns): boolean {
  return (
    patterns.credit.test(code) ||
    RECEIVABLE_DEBIT.test(code) ||
    TREASURY_LEG.test(code)
  );
}

/**
 * Classify a transaction line as project cost (kiadás) or revenue (bevétel).
 * Extends the create-form profiles with import and ügylet-sablon orientations
 * (swapped 4xxx/1xxx legs, 12xx/4200 megítélés, 15xx eszköz).
 */
export function classifyLedgerMovement(
  debitCode: string | null | undefined,
  creditCode: string | null | undefined,
  patterns: AccountCodePatterns = DEFAULT_ACCOUNT_CODE_PATTERNS,
): LedgerMovementKind | null {
  const debit = normalizeAccountCode(debitCode);
  const credit = normalizeAccountCode(creditCode);
  if (!debit || !credit) return null;

  const cashOrStockCredit = isCreditCode(credit, patterns.credit);

  const costDebit =
    isDebitCode(debit, patterns.debit) || CAPEX_DEBIT.test(debit);
  if (costDebit && cashOrStockCredit) return 'cost';

  const revOnDebit = REVENUE_CREDIT.test(debit);
  const revOnCredit = REVENUE_CREDIT.test(credit);
  if (revOnDebit || revOnCredit) {
    const other = revOnDebit ? credit : debit;
    if (isDebitCode(other, patterns.debit)) return null;
    if (isFundingLeg(other, patterns)) return 'revenue';
  }

  return null;
}
