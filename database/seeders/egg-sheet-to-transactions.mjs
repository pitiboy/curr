#!/usr/bin/env node
/**
 * Google Sheet tojás napló → edizone transactions.json (httpyac import).
 *
 *   node database/seeders/egg-sheet-to-transactions.mjs [--csv path] [--out path]
 *   node database/seeders/egg-sheet-to-transactions.mjs --url "https://docs.google.com/..."
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assignRelatedEnteredKeys } from './transaction-event-anchor.mjs';
import {
  importKeys,
  memberIdentifierBase,
} from './transaction-import-keys.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const poultryConstants = JSON.parse(
  readFileSync(resolve(__dirname, 'egg-poultry.constants.json'), 'utf8'),
);

// --- Cutoffs: only rows on or after these dates are imported (opening stock = 0) ---
export const PRODUCTION_FROM = '2026-10-01';
export const SALES_FROM = '2026-10-01';
export const DISTRIBUTION_FROM = PRODUCTION_FROM;

/**
 * Share rule from PRODUCTION_FROM (for later stock/settlement reports; does not
 * change how Dávid/Peti/Gabi withdrawal cells are booked).
 */
export const SHARES_FROM_2026_09_01 = {
  from: PRODUCTION_FROM,
  members: ['Dávid', 'Peti', 'Gabi'],
  shareEach: 1 / 3,
};

/** When Location is empty, skip unless set to e.g. '25'. */
export const EMPTY_LOCATION_FALLBACK = null;

export const LOCATION_TO_ORG = {
  24: '2024 alom',
  25: '2025 alom',
  26: '2026 alom',
  Perczel3: null,
};

/** Pooled egg stock org (I/4.12.1.2 → Tyúktartás in seed). */
export const POULTRY_STOCK_ORGANIZATION =
  poultryConstants.poultryStockOrganizationName;

/** @deprecated use POULTRY_STOCK_ORGANIZATION */
export const DISTRIBUTION_ORGANIZATION = POULTRY_STOCK_ORGANIZATION;

/** Default sheet name → member identifier when EGG_SHEET_MEMBERS is unset. */
export const DEFAULT_SHEET_MEMBER_TO_IDENTIFIER = {
  Dávid: 'dávid',
  Peti: 'peti',
  Gabi: 'gabi',
};

/** @deprecated use DEFAULT_SHEET_MEMBER_TO_IDENTIFIER */
export const SHEET_MEMBER_TO_IDENTIFIER = DEFAULT_SHEET_MEMBER_TO_IDENTIFIER;

/**
 * EGG_SHEET_MEMBERS: JSON object or comma-separated `SheetName=identifier` pairs.
 */
export function parseSheetMemberMap(raw) {
  if (raw == null || !String(raw).trim()) {
    return { ...DEFAULT_SHEET_MEMBER_TO_IDENTIFIER };
  }
  const text = String(raw).trim();
  if (text.startsWith('{')) {
    const parsed = JSON.parse(text);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON must be an object');
    }
    return { ...parsed };
  }
  const map = {};
  for (const segment of text.split(',')) {
    const part = segment.trim();
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq <= 0) {
      throw new Error(`expected name=identifier, got ${JSON.stringify(part)}`);
    }
    const name = part.slice(0, eq).trim();
    const identifier = part.slice(eq + 1).trim();
    if (!name || !identifier) {
      throw new Error(`expected name=identifier, got ${JSON.stringify(part)}`);
    }
    map[name] = identifier;
  }
  if (!Object.keys(map).length) {
    throw new Error('empty mapping');
  }
  return map;
}

export function loadSheetMemberMap(envValue = process.env.EGG_SHEET_MEMBERS) {
  try {
    return parseSheetMemberMap(envValue);
  } catch (error) {
    throw new Error(`EGG_SHEET_MEMBERS: ${error.message}`);
  }
}

export const ACCOUNTS = {
  inventory: 'Készletek',
  production: 'Saját termelésű készletek állományváltozása',
  revenue: 'Értékesítés bevétele',
  salesCost: 'Értékesítési költségek',
};

export const HEADER_MARKERS = ['Date', 'Location', 'Collected'];

const DEFAULT_CSV = resolve(__dirname, 'fixtures/egg-sheet.csv');
const DEFAULT_OUT = resolve(__dirname, 'http/edizone/data/transactions.json');

const DISTRIBUTION_MEMBERS = [
  { column: 'Dávid', label: 'Dávid' },
  { column: 'Peti', label: 'Peti' },
  { column: 'Gabi', label: 'Gabi' },
];

export function parseEggDate(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw);
  if (dash) {
    const [, d, m, y] = dash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export function parseIntegerCell(value) {
  if (value == null) return 0;
  const text = String(value).replace(/\s+/g, '').replace(/,/g, '').trim();
  if (!text || text === '-') return 0;
  const n = Number(text);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function parseHufAmount(value) {
  if (value == null) return 0;
  const text = String(value)
    .replace(/\s+/g, '')
    .replace(/,/g, '')
    .replace(/Ft\.?$/i, '')
    .trim();
  if (!text) return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

/** Minimal RFC-style CSV row split (handles quoted fields). */
export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function findHeaderIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (
      cols[0] === 'Date' &&
      cols[1] === 'Location' &&
      cols[2] === 'Collected'
    ) {
      return i;
    }
  }
  throw new Error('CSV header row (Date,Location,Collected,…) not found');
}

export function parseEggSheetCsv(text) {
  const lines = text.split(/\r?\n/);
  const headerIdx = findHeaderIndex(lines);
  const header = parseCsvLine(lines[headerIdx]);
  const col = (name) => {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`missing column ${name}`);
    return idx;
  };
  const idx = {
    date: col('Date'),
    location: col('Location'),
    collected: col('Collected'),
    collector: col('Collector'),
    david: col('Dávid'),
    peti: col('Peti'),
    gabi: col('Gabi'),
    notes: col('Notes'),
    seller: col('Eladó'),
    commissionPerson: col('Közrem.'),
    unitPrice: col('Ár/db'),
    qty: col('Db'),
    buyer: col('Vásárló'),
    revenueHuf: col('Ft bevétel'),
    commissionHuf: col('10% közrem.díj'),
  };

  const rows = [];
  for (let lineNo = headerIdx + 1; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const dateRaw = cells[idx.date] ?? '';
    const locationRaw = (cells[idx.location] ?? '').trim();
    const collected = parseIntegerCell(cells[idx.collected]);
    const hasMember =
      parseIntegerCell(cells[idx.david]) !== 0 ||
      parseIntegerCell(cells[idx.peti]) !== 0 ||
      parseIntegerCell(cells[idx.gabi]) !== 0;
    const hasSale =
      (cells[idx.seller] ?? '').trim() ||
      parseIntegerCell(cells[idx.qty]) !== 0 ||
      parseHufAmount(cells[idx.revenueHuf]) !== 0;
    if (!dateRaw && !locationRaw && collected === 0 && !hasMember && !hasSale) {
      continue;
    }
    rows.push({
      sheetRow: lineNo + 1,
      dateRaw,
      location: locationRaw,
      collected,
      collector: (cells[idx.collector] ?? '').trim(),
      david: parseIntegerCell(cells[idx.david]),
      peti: parseIntegerCell(cells[idx.peti]),
      gabi: parseIntegerCell(cells[idx.gabi]),
      notes: (cells[idx.notes] ?? '').trim(),
      seller: (cells[idx.seller] ?? '').trim(),
      commissionPerson: (cells[idx.commissionPerson] ?? '').trim(),
      unitPrice: parseIntegerCell(cells[idx.unitPrice]),
      saleQty: parseIntegerCell(cells[idx.qty]),
      buyer: (cells[idx.buyer] ?? '').trim(),
      revenueHuf: parseHufAmount(cells[idx.revenueHuf]),
      commissionHuf: parseHufAmount(cells[idx.commissionHuf]),
    });
  }
  return rows;
}

export function resolveLocationOrg(location) {
  const key = location === '' ? '' : location;
  if (!key) {
    if (EMPTY_LOCATION_FALLBACK != null) {
      return LOCATION_TO_ORG[EMPTY_LOCATION_FALLBACK] ?? null;
    }
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(LOCATION_TO_ORG, key)) {
    return LOCATION_TO_ORG[key];
  }
  return undefined;
}

export function memberRef(sheetName, memberMap) {
  const id = memberMap[sheetName];
  if (!id) return null;
  return `saját:${id}`;
}

export function memberIdentifier(sheetName, memberMap) {
  const mapped = memberMap[sheetName];
  if (mapped) return mapped;
  return memberIdentifierBase(sheetName);
}

function onOrAfter(isoDate, cutoff) {
  return isoDate != null && isoDate >= cutoff;
}

function baseTxn(row, leg, fields) {
  return {
    sheet_row: row.sheetRow,
    leg,
    row: row.sheetRow,
    date: fields.date,
    amount: fields.amount,
    currency: fields.currency,
    credit_account: fields.credit_account,
    debit_account: fields.debit_account,
    organization: fields.organization,
    transaction_type: fields.transaction_type ?? 'Átvezetés',
    description: fields.description,
  };
}

function collectorSuffix(collector) {
  if (!collector) return '';
  return ` (gyűjtötte: ${collector})`;
}

/**
 * @returns {{ transactions: object[], warnings: string[], stats: object, duplicateGroups: string[] }}
 */
export function sheetRowsToTransactions(rows, options = {}) {
  const productionFrom = options.productionFrom ?? PRODUCTION_FROM;
  const salesFrom = options.salesFrom ?? SALES_FROM;
  const distributionFrom = options.distributionFrom ?? DISTRIBUTION_FROM;
  const memberMap = options.memberMap ?? {
    ...DEFAULT_SHEET_MEMBER_TO_IDENTIFIER,
  };
  const poultryStockOrg =
    options.poultryStockOrganization ?? POULTRY_STOCK_ORGANIZATION;

  const warnings = [];
  const transactions = [];
  const stats = {
    production: 0,
    poolTransferCoop: 0,
    poolTransferParent: 0,
    distribution: 0,
    saleEgg: 0,
    saleRevenue: 0,
    saleCommission: 0,
  };
  const duplicateTracker = new Map();

  for (const row of rows) {
    const isoDate = parseEggDate(row.dateRaw);
    if (!isoDate) {
      if (row.dateRaw.trim()) {
        warnings.push(
          `row ${row.sheetRow}: invalid date ${JSON.stringify(row.dateRaw)}`,
        );
      }
      continue;
    }

    let org = resolveLocationOrg(row.location);
    if (org === undefined) {
      warnings.push(
        `row ${row.sheetRow}: unknown location ${JSON.stringify(row.location)}, skipped`,
      );
      continue;
    }
    if (org === null) {
      warnings.push(`row ${row.sheetRow}: empty or unmapped location, skipped`);
      continue;
    }

    const dupKey = `${isoDate}|${row.location}`;
    duplicateTracker.set(dupKey, (duplicateTracker.get(dupKey) || 0) + 1);

    const orgLabel = org;

    if (onOrAfter(isoDate, productionFrom) && row.collected > 0) {
      const description = `Tojás termelés – ${orgLabel}${collectorSuffix(row.collector)}`;
      transactions.push(
        baseTxn(row, 'production', {
          date: isoDate,
          amount: row.collected,
          currency: 'EGG',
          debit_account: ACCOUNTS.inventory,
          credit_account: ACCOUNTS.production,
          organization: org,
          description,
        }),
      );
      stats.production += 1;

      transactions.push(
        baseTxn(row, 'pool-transfer-coop', {
          date: isoDate,
          amount: row.collected,
          currency: 'EGG',
          debit_account: ACCOUNTS.production,
          credit_account: ACCOUNTS.inventory,
          organization: org,
          description: `Tojás készlet átvezetés (ól) – ${orgLabel} → ${poultryStockOrg}`,
          transaction_type: 'Átvezetés',
        }),
      );
      stats.poolTransferCoop += 1;

      transactions.push(
        baseTxn(row, 'pool-transfer-parent', {
          date: isoDate,
          amount: row.collected,
          currency: 'EGG',
          debit_account: ACCOUNTS.inventory,
          credit_account: ACCOUNTS.production,
          organization: poultryStockOrg,
          description: `Tojás készlet átvezetés (Tyúktartás) – ${orgLabel}`,
          transaction_type: 'Átvezetés',
        }),
      );
      stats.poolTransferParent += 1;
    }

    if (onOrAfter(isoDate, distributionFrom)) {
      for (const { label } of DISTRIBUTION_MEMBERS) {
        const field =
          label === 'Dávid' ? 'david' : label === 'Peti' ? 'peti' : 'gabi';
        const amount = parseIntegerCell(row[field]);
        if (amount <= 0) continue;
        const debit = memberRef(label, memberMap);
        if (!debit) {
          warnings.push(
            `row ${row.sheetRow}: no EGG_SHEET_MEMBERS mapping for ${JSON.stringify(label)} (distribution skipped)`,
          );
          continue;
        }
        transactions.push(
          baseTxn(row, `distribution:${memberIdentifier(label, memberMap)}`, {
            date: isoDate,
            amount,
            currency: 'EGG',
            debit_account: debit,
            credit_account: ACCOUNTS.inventory,
            organization: poultryStockOrg,
            description: `Tojás kivét – ${orgLabel}, ${label}`,
          }),
        );
        stats.distribution += 1;
      }
    }

    const hasSaleFields =
      row.seller ||
      row.saleQty > 0 ||
      row.revenueHuf > 0 ||
      row.unitPrice > 0 ||
      row.buyer;
    if (hasSaleFields && onOrAfter(isoDate, salesFrom)) {
      if (!row.seller || row.unitPrice <= 0) {
        warnings.push(
          `row ${row.sheetRow}: sale skipped (missing seller or unit price)`,
        );
      } else if (row.revenueHuf <= 0) {
        warnings.push(
          `row ${row.sheetRow}: sale skipped (0 Ft revenue or missing amount)`,
        );
      } else if (row.saleQty <= 0) {
        warnings.push(`row ${row.sheetRow}: sale skipped (missing Db qty)`);
      } else {
        const sellerRef = memberRef(row.seller, memberMap);
        if (!sellerRef) {
          warnings.push(
            `row ${row.sheetRow}: no EGG_SHEET_MEMBERS mapping for seller ${JSON.stringify(row.seller)} (sale skipped)`,
          );
        } else {
          transactions.push(
            baseTxn(row, 'sale:egg', {
              date: isoDate,
              amount: row.saleQty,
              currency: 'EGG',
              debit_account: ACCOUNTS.salesCost,
              credit_account: ACCOUNTS.inventory,
              organization: poultryStockOrg,
              description: `Tojás eladás (készlet) – ${orgLabel}, eladó: ${row.seller}, vevő: ${row.buyer || '—'}`,
            }),
          );
          stats.saleEgg += 1;

          transactions.push(
            baseTxn(row, 'sale:revenue', {
              date: isoDate,
              amount: row.revenueHuf,
              currency: 'HUF',
              debit_account: sellerRef,
              credit_account: ACCOUNTS.revenue,
              organization: poultryStockOrg,
              description: `Tojás eladás bevétel – ${orgLabel}, eladó: ${row.seller}, vevő: ${row.buyer || '—'}`,
            }),
          );
          stats.saleRevenue += 1;

          if (row.commissionPerson && row.commissionHuf > 0) {
            const commRef = memberRef(row.commissionPerson, memberMap);
            if (!commRef) {
              warnings.push(
                `row ${row.sheetRow}: no EGG_SHEET_MEMBERS mapping for ${JSON.stringify(row.commissionPerson)} (commission skipped)`,
              );
            } else {
              transactions.push(
                baseTxn(row, 'sale:commission', {
                  date: isoDate,
                  amount: row.commissionHuf,
                  currency: 'HUF',
                  debit_account: commRef,
                  credit_account: ACCOUNTS.revenue,
                  organization: poultryStockOrg,
                  description: `Tojás eladás közreműködői díj – ${orgLabel}, ${row.commissionPerson}`,
                }),
              );
              stats.saleCommission += 1;
            }
          }
        }
      }
    }
  }

  const duplicateGroups = [...duplicateTracker.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => `${key} (${count} sor)`);

  return { transactions, warnings, stats, duplicateGroups };
}

export function buildTransactionsJson(parsedRows, meta = {}) {
  const memberMap =
    meta.memberMap ??
    (meta.loadMemberMapFromEnv
      ? loadSheetMemberMap()
      : { ...DEFAULT_SHEET_MEMBER_TO_IDENTIFIER });
  const { transactions, warnings, stats, duplicateGroups } =
    sheetRowsToTransactions(parsedRows, { ...meta, memberMap });
  const source = {
    source:
      meta.source ||
      'Google Sheet tojás napló (https://docs.google.com/spreadsheets/d/1e6A-b-t7wnbucXVwp0wXBISN_MDJ1ox9fESBHNwi6f0/)',
    keyPrefix: 'egg-sheet:row#',
    importKeyPrefix: 'egg-sheet:',
    mainOrganization: 'EdiZone @Kömlőd',
    entered_key_fields: [
      'currency',
      'date',
      'amount',
      'leg',
      'sheet_row',
      'debit_account',
      'credit_account',
      'organization',
    ],
    transactions,
  };
  const keys = importKeys(source);
  const withKeys = transactions.map((row, index) => ({
    ...row,
    entered_key: keys[index],
  }));
  source.transactions = assignRelatedEnteredKeys(withKeys);
  return { json: source, warnings, stats, duplicateGroups };
}

async function loadCsvText(args) {
  const urlArg = args.indexOf('--url');
  if (urlArg !== -1) {
    const url = args[urlArg + 1];
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fetch failed ${response.status} ${url}`);
    }
    return response.text();
  }
  let path = DEFAULT_CSV;
  const csvArg = args.indexOf('--csv');
  if (csvArg !== -1) path = resolve(args[csvArg + 1]);
  return readFileSync(path, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const text = await loadCsvText(args);
  const parsed = parseEggSheetCsv(text);
  const memberMap = loadSheetMemberMap();
  const { json, warnings, stats, duplicateGroups } = buildTransactionsJson(
    parsed,
    {
      memberMap,
    },
  );

  let out = DEFAULT_OUT;
  const outArg = args.indexOf('--out');
  if (outArg !== -1) out = resolve(args[outArg + 1]);

  writeFileSync(out, `${JSON.stringify(json, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${json.transactions.length} transactions to ${out}`);
  console.log(
    `Counts: production=${stats.production} poolCoop=${stats.poolTransferCoop} ` +
      `poolParent=${stats.poolTransferParent} distribution=${stats.distribution} ` +
      `saleEgg=${stats.saleEgg} saleRevenue=${stats.saleRevenue} saleCommission=${stats.saleCommission}`,
  );
  if (duplicateGroups.length) {
    console.log('Duplicate date+location groups:', duplicateGroups.join('; '));
  }
  if (warnings.length) {
    console.warn(`${warnings.length} warning(s):`);
    warnings.forEach((w) => console.warn('  ' + w));
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
