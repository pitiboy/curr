/**
 * Közös árfolyam-választási szabály tranzakció-kifejtéshez és backoffice számításokhoz.
 *
 * A forrás tranzakció `date` mezőjének **naptári napja** (első 10 karakter, YYYY-MM-DD)
 * határozza meg, melyik `currency-rate` sor érvényes. A mezőt a felületen Europe/Budapest
 * naptári dátumként rögzítjük (Strapi `date` → általában csak YYYY-MM-DD). Teljes
 * időbélyeg esetén is a **dátum előtag** számít, nem az UTC pillanat — így
 * `2024-12-31T23:30:00+01:00` és `2025-01-01T00:30:00+01:00` külön napnak számít.
 *
 * Választás: a legfrissebb sor, amelynek `valid_from` ≤ a tranzakció napjának vége
 * Europe/Budapest szerint (téli időben `{nap}T22:59:59.999Z`). Későbbi (a nap utáni) árfolyam soha nem használható.
 * Ha nincs korábbi sor → hiba (CURRENCY_RATE_MISSING).
 *
 * KOR pár: hiányzó direkt `from → to` esetén `1 / rate(to → from)`, ugyanazzal a dátum
 * szabállyal az inverz sorra is. Nem-KOR párnál nincs inverz.
 */

/** `YYYY-MM-DD` a tranzakció dátum mezőjéből. */
export function transactionRateIsoDay(date: string): string {
  return String(date ?? '').slice(0, 10);
}

const RATE_TIME_ZONE = 'Europe/Budapest';

const budapestPartsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: RATE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Europe/Budapest UTC-eltolás (ms) az adott pillanatban. */
function budapestOffsetMs(instantMs: number): number {
  const parts: Record<string, number> = {};
  for (const part of budapestPartsFormat.formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * A tranzakció napjának inkluzív vége **Budapest idő szerint** (UTC ISO).
 * A `valid_from` helyi éjfélre van állítva (pl. 11-01 00:00 = 10-31T23:00Z),
 * ezért UTC napvéggel a következő napi árfolyam is átcsúszna.
 */
export function transactionRateCutoff(date: string): string {
  const [y, m, d] = transactionRateIsoDay(date).split('-').map(Number);
  const nextMidnightNaive = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  // Az átállás 01:00Z-kor van, így (éjfél − 2 óra) mindig egyértelmű mintavétel.
  const offset = budapestOffsetMs(nextMidnightNaive - 2 * 3600_000);
  return new Date(nextMidnightNaive - offset - 1).toISOString();
}

export function normalizeCurrencyCode(
  code: string | null | undefined,
): string | null {
  const trimmed = code?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/** Inverz fallback csak KOR-t érintő devizapárnál. */
export function currencyPairInvolvesKor(
  fromCode: string | null | undefined,
  toCode: string | null | undefined,
): boolean {
  const from = normalizeCurrencyCode(fromCode);
  const to = normalizeCurrencyCode(toCode);
  return from === 'KOR' || to === 'KOR';
}

export type TransactionRateRow = {
  rate: number | string;
  validFrom: string;
  fromKey: string;
  toKey: string;
  rowKey?: string | null;
};

export type PickedTransactionRate = {
  fromKey: string;
  toKey: string;
  rate: number;
  validFrom: string | null;
  rowKey: string | null;
  inverted: boolean;
};

/**
 * Legfrissebb direkt `fromKey → toKey` sor valid_from ≤ nap vége.
 * Azonos kulcs → rate 1 (nincs DB sor).
 */
export function pickDirectRateAtTransactionDate(
  rows: readonly TransactionRateRow[],
  fromKey: string,
  toKey: string,
  date: string,
): PickedTransactionRate | null {
  if (fromKey === toKey) {
    return {
      fromKey,
      toKey,
      rate: 1,
      validFrom: null,
      rowKey: null,
      inverted: false,
    };
  }
  const cutoff = Date.parse(transactionRateCutoff(date));
  let best: TransactionRateRow | null = null;
  let bestTime = -Infinity;
  for (const row of rows) {
    if (row.fromKey !== fromKey || row.toKey !== toKey) continue;
    const time = Date.parse(row.validFrom);
    if (!Number.isFinite(time) || time > cutoff) continue;
    if (time > bestTime) {
      best = row;
      bestTime = time;
    }
  }
  if (!best) return null;
  const rate = Number(best.rate);
  if (!Number.isFinite(rate)) return null;
  return {
    fromKey,
    toKey,
    rate,
    validFrom: best.validFrom,
    rowKey: best.rowKey ?? null,
    inverted: false,
  };
}

export type PickRateAtTransactionDateOptions = {
  fromCode?: string | null;
  toCode?: string | null;
};

/**
 * Direkt sor, majd opcionális KOR inverz — mindkét irány ugyanarra a tranzakció napra.
 */
export function pickRateAtTransactionDate(
  rows: readonly TransactionRateRow[],
  fromKey: string,
  toKey: string,
  date: string,
  options?: PickRateAtTransactionDateOptions,
): PickedTransactionRate | null {
  const direct = pickDirectRateAtTransactionDate(rows, fromKey, toKey, date);
  if (direct) return direct;
  if (!currencyPairInvolvesKor(options?.fromCode, options?.toCode)) return null;
  const inverse = pickDirectRateAtTransactionDate(rows, toKey, fromKey, date);
  if (!inverse || inverse.rate <= 0) return null;
  return {
    fromKey,
    toKey,
    rate: 1 / inverse.rate,
    validFrom: inverse.validFrom,
    rowKey: inverse.rowKey,
    inverted: true,
  };
}

/** Felhasználói (magyar) hibaüzenet hiányzó árfolyamnál. */
export function formatCurrencyRateMissingMessage(
  fromLabel: string,
  toLabel: string,
  date: string,
): string {
  const day = transactionRateIsoDay(date);
  return `Nincs érvényes árfolyam (${fromLabel} → ${toLabel}) a tranzakció dátumára: ${day}.`;
}

/** Backoffice: kód alapú sorok → közös választó. */
export function pickRateByCurrencyCodeAtTransactionDate(
  rows: readonly {
    rate: number;
    validFrom: string;
    fromCurrencyCode: string;
    toCurrencyCode: string;
  }[],
  fromCode: string,
  toCode: string,
  date: string,
): {
  rate: number;
  validFrom: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  inverted: boolean;
} | null {
  const mapped: TransactionRateRow[] = rows.map((row) => ({
    rate: row.rate,
    validFrom: row.validFrom,
    fromKey: row.fromCurrencyCode,
    toKey: row.toCurrencyCode,
  }));
  const picked = pickRateAtTransactionDate(mapped, fromCode, toCode, date, {
    fromCode,
    toCode,
  });
  if (!picked) return null;
  return {
    rate: picked.rate,
    validFrom:
      picked.validFrom ?? `${transactionRateIsoDay(date)}T00:00:00.000Z`,
    fromCurrencyCode: fromCode,
    toCurrencyCode: toCode,
    inverted: picked.inverted,
  };
}
