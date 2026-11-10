/**
 * Poultry flock (Tyúktartás) report shapes.
 *
 * Source: Content API transactions in HEN (tojó) and ROOSTER (kakas)
 * currencies that touch the `1300` Készletek account on the Tyúktartás
 * hen-house orgs (one org per alom).
 *
 * - debit 1300 → állomány növekedés (csibe vásárlás, nyitó egyenleg, …)
 * - credit 1300, debit 5810 → elhullás
 * - credit 1300, debit tag 1001 (saját) → levágás
 * - credit 1300, any other debit → egyéb kivezetés
 *
 * Headcount = running balance of 1300 per alom; the opening balance includes
 * every movement before the selected range.
 */

export type { DateRangePreset } from '../shared/reportDateRange';

export const POULTRY_FLOCK_FEATURE_ID = 'poultry-flock';

export const FLOCK_STOCK_ACCOUNT_CODE = '1300';
export const FLOCK_MORTALITY_ACCOUNT_CODE = '5810';
export const FLOCK_MEMBER_PRIVATE_ACCOUNT_CODE = '1001';

export const FLOCK_CURRENCY_HEN = 'HEN';
export const FLOCK_CURRENCY_ROOSTER = 'ROOSTER';
export const FLOCK_CURRENCIES = [
  FLOCK_CURRENCY_HEN,
  FLOCK_CURRENCY_ROOSTER,
] as const;

export type FlockAnimal = 'hen' | 'rooster';

export type FlockMovementKind = 'added' | 'died' | 'slaughtered' | 'otherOut';

export type FlockCounts = {
  hen: number;
  rooster: number;
  total: number;
};

export type PoultryFlockKpis = {
  opening: FlockCounts;
  added: FlockCounts;
  died: FlockCounts;
  slaughtered: FlockCounts;
  otherOut: FlockCounts;
  closing: FlockCounts;
};

export type FlockTimeseriesPoint = {
  /** Bucket key (YYYY-MM-DD or YYYY-MM). */
  period: string;
  /** Alom name → headcount (hen + rooster) at the end of the bucket. */
  headcountByAlom: Record<string, number>;
  headcount: FlockCounts;
  /** Movements inside the bucket (all positive numbers). */
  added: number;
  died: number;
  slaughtered: number;
  otherOut: number;
};

export type FlockAlomRow = {
  alomName: string;
  opening: number;
  added: number;
  died: number;
  slaughtered: number;
  otherOut: number;
  closing: number;
  closingHen: number;
  closingRooster: number;
  /** died / (opening + added), 0..1; null when the base is 0. */
  mortalityRate: number | null;
};

export type PoultryFlockReport = {
  kpis: PoultryFlockKpis;
  alomNames: string[];
  timeseries: FlockTimeseriesPoint[];
  byAlom: FlockAlomRow[];
};

export type PoultryFlockStatus = 'loading' | 'success' | 'empty' | 'error';
