#!/usr/bin/env node
// Content-based import keys for the Excel transaction seeder.
//
//   node database/seeders/transaction-import-keys.mjs [file] [--check]
//
// Writes `import_key` into every row of transactions.json. The key is
//   excel:<first 20 hex chars of sha256(the fields in import_key_fields)>
// `import_key_fields` is a top-level array in the same JSON. `currency` means
// the row's `currency`, or the file's `currencyCode` when the row has none;
// every other name must be a column of every row. Identical keys get `#2`,
// `#3`... in file order, so identical rows still import separately. The Excel
// row number is never part of the key: reordering or inserting rows keeps the
// keys, while changing one of the key fields gives the row a new key.
// --check recomputes the keys from the configured fields and exits 1 if any
// stored key is missing or stale (also when import_key_fields was changed
// without regenerating).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HASH_LENGTH = 20;
const CURRENCY = 'currency';

function normalize(field, value) {
  if (value === null || value === undefined) return '';
  if (field === 'amount') return Number(value).toFixed(2);
  return String(value).normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Validates import_key_fields against the rows; throws with a clear message. */
export function keyFields(source) {
  const fields = source.import_key_fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('import_key_fields is missing or empty in transactions.json');
  }
  const rows = source.transactions || [];
  const seen = new Set();
  for (const field of fields) {
    if (typeof field !== 'string' || !field.trim()) {
      throw new Error(`import_key_fields contains an invalid name: ${JSON.stringify(field)}`);
    }
    if (seen.has(field)) throw new Error(`import_key_fields lists "${field}" twice`);
    seen.add(field);
    if (field === 'import_key' || field === 'row') {
      throw new Error(`import_key_fields must not contain "${field}"`);
    }
    if (field === CURRENCY) {
      const missing = rows.filter((row) => !(CURRENCY in row) && !source.currencyCode);
      if (missing.length) {
        throw new Error('import_key_fields uses "currency" but there is no currencyCode and rows have no currency');
      }
      continue;
    }
    const missing = rows.filter((row) => !(field in row));
    if (missing.length) {
      throw new Error(
        `import_key_fields names "${field}", but ${missing.length} rows do not have it (first: row ${missing[0].row})`,
      );
    }
  }
  return fields;
}

export function canonicalRow(row, fields, currencyCode = '') {
  return JSON.stringify(
    fields.map((field) =>
      normalize(field, field === CURRENCY && !(CURRENCY in row) ? currencyCode : row[field]),
    ),
  );
}

export function importKeys(source) {
  const fields = keyFields(source);
  const seen = new Map();
  return (source.transactions || []).map((row) => {
    const hash = createHash('sha256')
      .update(canonicalRow(row, fields, source.currencyCode), 'utf8')
      .digest('hex')
      .slice(0, HASH_LENGTH);
    const count = (seen.get(hash) || 0) + 1;
    seen.set(hash, count);
    return 'excel:' + hash + (count > 1 ? '#' + count : '');
  });
}

/** Puts import_key right after row, so the JSON stays readable. */
function withKey(row, key) {
  const out = {};
  for (const [name, value] of Object.entries(row)) {
    if (name === 'import_key') continue;
    out[name] = value;
    if (name === 'row') out.import_key = key;
  }
  if (!('import_key' in out)) out.import_key = key;
  return out;
}

function main(argv) {
  const check = argv.includes('--check');
  const file = resolve(
    argv.find((arg) => !arg.startsWith('--')) ||
      'database/seeders/http/kor/data/transactions.json',
  );
  const source = JSON.parse(readFileSync(file, 'utf8'));
  const rows = source.transactions || [];
  let keys;
  try {
    keys = importKeys(source);
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exit(1);
  }
  const stale = rows.filter((row, index) => row.import_key !== keys[index]);
  const fields = source.import_key_fields.join(', ');

  if (check) {
    if (stale.length) {
      console.error(
        `${stale.length} of ${rows.length} rows have a missing or stale import_key (fields: ${fields}) in ${file}`,
      );
      process.exit(1);
    }
    console.log(`${rows.length} import keys ok (fields: ${fields}) in ${file}`);
    return;
  }

  source.transactions = rows.map((row, index) => withKey(row, keys[index]));
  writeFileSync(file, JSON.stringify(source, null, 2) + '\n');
  console.log(`${rows.length} rows, ${stale.length} keys updated (fields: ${fields}) in ${file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
