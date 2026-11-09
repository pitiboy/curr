/**
 * Poultry inventory report (CHICK, HEN, ROOSTER).
 *
 * Stock per hen-house org = net poultry headcount on ledger 1300 (debit +, credit −).
 * Slaughter = member 1001 ← inventory 1300 with Levágás in description.
 * Transfer = same leg pattern without slaughter wording (optional átadás marker).
 */

import type { DateRangePreset } from '../shared/reportDateRange';

export type { DateRangePreset };

export type HenInventoryKpis = {
  /** Stock across all alom at end of the selected range. */
  totalStock: number;
  slaughterInPeriod: number;
  transferInPeriod: number;
  mortalityInPeriod: number;
  intakeInPeriod: number;
};

export type HenStockTimeseriesPoint = {
  period: string;
  /** Alom display name → head count at end of period. */
  byAlom: Record<string, number>;
};

export type HenAlomRow = {
  alomName: string;
  stockEnd: number;
  intake: number;
  mortality: number;
};

export type HenMemberOutflowRow = {
  memberId: string;
  memberName: string;
  accountLabel: string;
  slaughterQty: number;
  transferQty: number;
};

export type HenOutflowTimeseriesPoint = {
  period: string;
  /** memberId → slaughter qty in bucket */
  slaughterByMember: Record<string, number>;
  /** memberId → transfer qty in bucket */
  transferByMember: Record<string, number>;
};

export type HenInventoryReport = {
  kpis: HenInventoryKpis;
  stockTimeseries: HenStockTimeseriesPoint[];
  byAlom: HenAlomRow[];
  outflowTimeseries: HenOutflowTimeseriesPoint[];
  byMember: HenMemberOutflowRow[];
};

export type HenInventoryStatus = 'loading' | 'success' | 'empty' | 'error';
