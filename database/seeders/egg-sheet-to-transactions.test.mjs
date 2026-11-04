import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PRODUCTION_FROM,
  SALES_FROM,
  buildTransactionsJson,
  parseEggDate,
  parseEggSheetCsv,
  parseHufAmount,
  parseIntegerCell,
  resolveLocationOrg,
  sheetRowsToTransactions,
} from './egg-sheet-to-transactions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureCsv = readFileSync(
  resolve(__dirname, 'fixtures/egg-sheet.csv'),
  'utf8',
);

describe('parseEggDate', () => {
  it('parses slash and dash formats', () => {
    assert.equal(parseEggDate('09/10/2026'), '2026-10-09');
    assert.equal(parseEggDate('22-01-2026'), '2026-01-22');
    assert.equal(parseEggDate(''), null);
  });
});

describe('parseIntegerCell', () => {
  it('handles blanks and integers', () => {
    assert.equal(parseIntegerCell(''), 0);
    assert.equal(parseIntegerCell('7'), 7);
    assert.equal(parseIntegerCell('-9'), -9);
  });
});

describe('parseHufAmount', () => {
  it('strips thousands separators', () => {
    assert.equal(parseHufAmount('1,234'), 1234);
    assert.equal(parseHufAmount('42'), 42);
  });
});

describe('resolveLocationOrg', () => {
  it('maps coop codes', () => {
    assert.equal(resolveLocationOrg('25'), '2025 alom');
    assert.equal(resolveLocationOrg(''), null);
    assert.equal(resolveLocationOrg('99'), undefined);
  });
});

describe('parseEggSheetCsv', () => {
  it('skips summary block and reads data rows', () => {
    const rows = parseEggSheetCsv(fixtureCsv);
    assert.ok(rows.length > 200);
    const first = rows[0];
    assert.equal(first.dateRaw, '22-01-2026');
    assert.equal(first.location, '24');
    assert.equal(first.collected, 7);
  });
});

describe('sheetRowsToTransactions cutoffs', () => {
  it('imports production from PRODUCTION_FROM only', () => {
    const rows = parseEggSheetCsv(fixtureCsv);
    const { transactions, stats } = sheetRowsToTransactions(rows);
    assert.ok(stats.production > 0);
    for (const txn of transactions.filter((t) => t.leg === 'production')) {
      assert.ok(txn.date >= PRODUCTION_FROM);
    }
  });

  it('skips incomplete sale after SALES_FROM', () => {
    const rows = parseEggSheetCsv(fixtureCsv);
    const { warnings } = sheetRowsToTransactions(rows);
    assert.ok(warnings.some((w) => w.includes('row 299') && w.includes('sale skipped')));
    const saleRows = rows.filter(
      (r) => r.dateRaw === '19/10/2026' && r.location === '26',
    );
    assert.equal(saleRows.length, 1);
    const { transactions } = sheetRowsToTransactions(rows);
    assert.equal(
      transactions.filter(
        (t) => t.sheet_row === saleRows[0].sheetRow && t.leg.startsWith('sale'),
      ).length,
      0,
    );
  });

  it('warns on empty location row', () => {
    const rows = parseEggSheetCsv(fixtureCsv);
    const { warnings } = sheetRowsToTransactions(rows);
    assert.ok(warnings.some((w) => w.includes('empty or unmapped location')));
  });
});

describe('buildTransactionsJson', () => {
  it('assigns egg-sheet entered_key prefix', () => {
    const rows = parseEggSheetCsv(fixtureCsv);
    const { json } = buildTransactionsJson(rows);
    assert.equal(json.importKeyPrefix, 'egg-sheet:');
    assert.ok(json.transactions.length > 0);
    assert.ok(json.transactions.every((t) => t.entered_key.startsWith('egg-sheet:')));
    const currencies = new Set(json.transactions.map((t) => t.currency));
    assert.ok(currencies.has('EGG'));
    const withEarlierSales = buildTransactionsJson(rows, { salesFrom: '2026-01-01' });
    assert.ok(
      withEarlierSales.json.transactions.some((t) => t.currency === 'HUF'),
    );
  });
});
