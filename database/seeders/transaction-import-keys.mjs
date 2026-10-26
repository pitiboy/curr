#!/usr/bin/env node
// Import keys and account booking for the Excel transaction seeder.
//
//   node database/seeders/transaction-import-keys.mjs [transactions.json] [--check] [--xlsx file]
//
// Reads the Pénzmozgások sheet (or the labels already stored on each row) and
// writes, for every row:
//   credit_account, debit_account  — chart account name, or tag:<id> / saját:<id>
//   organization                    — an organizations.json name
//   transaction_type                — when operation or place maps to one
//   import_key                      — excel:<20 hex of sha256(import_key_fields)>
//
// Account labels come from the sheet columns credit_Account and Debit_account.
// A label that is a chart name is kept. "Név - Tagi számla" / "Név - Saját számla"
// become tag:<identifier> / saját:<identifier> (identifier rules match
// src/member-identifier.ts). ACCOUNT_ALIASES covers sheet wordings that are
// not chart names. Anything else is an error, so a new label cannot import
// onto the wrong account.
//
// Organization/Projekt is used as-is when it is an organization. Otherwise
// projectOrganizations applies (Zöld Élet Program → the main organization).
// operationTransactionTypes wins over placeTransactionTypes (Bányászás).
//
// import_key_fields is a top-level array in the JSON. `currency` means the
// row's currency, or the file's currencyCode. Identical keys get #2, #3… in
// file order. The Excel row number is not part of the key.
// Negative Excel amounts are stored as |amount|; követel/tartozik labels stay as in the sheet.
// import_key uses the stored (positive) amount; regen when amount or other key fields change.
// --check recomputes keys and booking and exits 1 if the file is stale.
// --xlsx reads the workbook and replaces the rows; with --check it only compares.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HASH_LENGTH = 20;
const CURRENCY = 'currency';
const SHEET_NAME = 'Pénzmozgások';

/** Sheet labels that are not names in accounts.json. Targets must be. */
export const ACCOUNT_ALIASES = {
  // Residential plots (Fő út), not buildings: 1520, not 1530 Lakóépületek.
  'Lakó földterületek': 'Belterületi földterületek',
  // Purchases booked on Termőterületek. The sheet's generic label is 1510.
  Földterületek: 'Mezőgazdasági földterületek',
  'Gazdasági földterületek': 'Mezőgazdasági földterületek',
  // Not a member. The cash account is the pénztár; there is no "saját" for it.
  'Pénztár - Saját számla': 'Készpénz',
};

const COL = {
  date: 1,
  payer: 4,
  credit: 5,
  payee: 6,
  debit: 7,
  ledger: 8,
  project: 9,
  purpose: 10,
  operation: 11,
  amount: 12,
  place: 13,
  description: 14,
};

const ROW_FIELDS = [
  'row',
  'import_key',
  'date',
  'payer',
  'payee',
  'ledger',
  'project',
  'purpose',
  'operation',
  'amount',
  'place',
  'description',
  'credit_label',
  'debit_label',
  'credit_account',
  'debit_account',
  'organization',
  'transaction_type',
];

/** Same rules as src/member-identifier.ts memberIdentifierBase. */
export function memberIdentifierBase(name) {
  const kept = /[a-z0-9áéíóöőúüű]/;
  let out = '';
  for (const char of String(name).normalize('NFC').toLocaleLowerCase('hu')) {
    if (kept.test(char)) {
      out += char;
      continue;
    }
    const plain = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += /^[a-z0-9]$/.test(plain) ? plain : '.';
  }
  return out.replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
}

export function fold(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(field, value) {
  if (value === null || value === undefined) return '';
  if (field === 'amount') return Number(value).toFixed(2);
  return fold(value);
}

/** Validates import_key_fields against the rows; throws with a clear message. */
export function keyFields(source) {
  const fields = source.import_key_fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(
      'import_key_fields is missing or empty in transactions.json',
    );
  }
  const rows = source.transactions || [];
  const seen = new Set();
  for (const field of fields) {
    if (typeof field !== 'string' || !field.trim()) {
      throw new Error(
        `import_key_fields contains an invalid name: ${JSON.stringify(field)}`,
      );
    }
    if (seen.has(field))
      throw new Error(`import_key_fields lists "${field}" twice`);
    seen.add(field);
    if (field === 'import_key' || field === 'row') {
      throw new Error(`import_key_fields must not contain "${field}"`);
    }
    if (field === CURRENCY) {
      const missing = rows.filter(
        (row) => !(CURRENCY in row) && !source.currencyCode,
      );
      if (missing.length) {
        throw new Error(
          'import_key_fields uses "currency" but there is no currencyCode and rows have no currency',
        );
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
      normalize(
        field,
        field === CURRENCY && !(CURRENCY in row) ? currencyCode : row[field],
      ),
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

function aliasTable() {
  const table = new Map();
  for (const [label, target] of Object.entries(ACCOUNT_ALIASES)) {
    const key = fold(label);
    if (!key || !target)
      throw new Error(
        `ACCOUNT_ALIASES has an empty entry: ${JSON.stringify(label)}`,
      );
    if (table.has(key))
      throw new Error(`ACCOUNT_ALIASES lists "${label}" twice`);
    table.set(key, target);
  }
  return table;
}

/**
 * Sheet account label → chart name, or tag:<identifier> / saját:<identifier>.
 * `accountNames` is the set of accounts.json names.
 */
export function resolveAccountLabel(
  label,
  accountNames,
  aliases = aliasTable(),
) {
  const text = fold(label);
  if (!text) throw new Error('empty account label');
  const byFold = new Map([...accountNames].map((name) => [fold(name), name]));
  if (aliases.has(text)) {
    const target = aliases.get(text);
    const canonical = byFold.get(fold(target));
    if (!canonical)
      throw new Error(`alias "${label}" points at unknown account "${target}"`);
    return canonical;
  }
  const exact = byFold.get(text);
  if (exact) return exact;
  const member = /^(.*?)\s-\s(tagi|saját)\s+számla$/iu.exec(text);
  if (member) {
    const identifier = memberIdentifierBase(member[1]);
    if (!identifier)
      throw new Error(`account label "${label}" has no member name`);
    const kind = member[2].toLocaleLowerCase('hu') === 'tagi' ? 'tag' : 'saját';
    return `${kind}:${identifier}`;
  }
  throw new Error(`no chart account for "${label}"`);
}

export function resolveOrganization(project, source, orgNames) {
  const name = fold(project);
  const canonical = (value) =>
    [...orgNames].find((org) => fold(org) === fold(value));
  if (!name) {
    const main = canonical(source.mainOrganization);
    if (!main)
      throw new Error(
        'row has no project and mainOrganization is not an organization',
      );
    return main;
  }
  const direct = canonical(name);
  if (direct) return direct;
  const table = source.projectOrganizations || {};
  const mapped = Object.entries(table).find(([key]) => fold(key) === name)?.[1];
  if (!mapped) throw new Error(`no organization for project "${project}"`);
  const org = canonical(mapped);
  if (!org)
    throw new Error(
      `project "${project}" maps to "${mapped}", which is not an organization`,
    );
  return org;
}

/** Excel előjel → mindig pozitív amount a JSON-ban; a számlacímkék változatlanok. */
export function absAmountRow(row) {
  if (row.amount === undefined || row.amount === null || row.amount === '')
    return row;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount))
    throw new Error(`row ${row.row}: not an amount: ${row.amount}`);
  const absAmount = Math.round(Math.abs(amount) * 100) / 100;
  if (amount === absAmount) return row;
  return { ...row, amount: absAmount };
}

export function resolveTransactionType(row, source, typeNames) {
  const name =
    (source.operationTransactionTypes &&
      source.operationTransactionTypes[row.operation]) ||
    (source.placeTransactionTypes && source.placeTransactionTypes[row.place]) ||
    null;
  if (!name) return null;
  const canonical = [...typeNames].find((type) => fold(type) === fold(name));
  if (!canonical)
    throw new Error(
      `row ${row.row}: transaction type "${name}" is not in transaction-types.json`,
    );
  return canonical;
}

function assertNamed(table, names, label, what) {
  for (const [key, value] of Object.entries(table || {})) {
    if (!value) continue;
    if (![...names].some((name) => fold(name) === fold(value))) {
      throw new Error(
        `${label}["${key}"] is "${value}", which is not a ${what}`,
      );
    }
  }
}

/** Fallback maps must point at the final chart, organizations, and types. */
export function assertLookupTables(source, ctx) {
  assertNamed(
    source.partyAccounts,
    ctx.accountNames,
    'partyAccounts',
    'chart account',
  );
  assertNamed(
    source.operationCreditAccounts,
    ctx.accountNames,
    'operationCreditAccounts',
    'chart account',
  );
  assertNamed(
    source.expenseDebitAccounts,
    ctx.accountNames,
    'expenseDebitAccounts',
    'chart account',
  );
  assertNamed(
    source.projectOrganizations,
    ctx.orgNames,
    'projectOrganizations',
    'organization',
  );
  assertNamed(
    source.placeTransactionTypes,
    ctx.typeNames,
    'placeTransactionTypes',
    'transaction type',
  );
  assertNamed(
    source.operationTransactionTypes,
    ctx.typeNames,
    'operationTransactionTypes',
    'transaction type',
  );
  if (
    source.mainOrganization &&
    ![...ctx.orgNames].some(
      (name) => fold(name) === fold(source.mainOrganization),
    )
  ) {
    throw new Error(
      `mainOrganization "${source.mainOrganization}" is not an organization`,
    );
  }
  for (const target of aliasTable().values()) {
    if (![...ctx.accountNames].some((name) => fold(name) === fold(target))) {
      throw new Error(`ACCOUNT_ALIASES points at unknown account "${target}"`);
    }
  }
}

export function bookRow(row, source, ctx) {
  const withAmount = absAmountRow(row);
  let credit;
  let debit;
  try {
    credit = resolveAccountLabel(withAmount.credit_label, ctx.accountNames);
    debit = resolveAccountLabel(withAmount.debit_label, ctx.accountNames);
  } catch (error) {
    throw new Error(`row ${row.row}: ${error.message}`);
  }
  let organization;
  try {
    organization = resolveOrganization(
      withAmount.project,
      source,
      ctx.orgNames,
    );
  } catch (error) {
    throw new Error(`row ${withAmount.row}: ${error.message}`);
  }
  const transactionType = resolveTransactionType(
    withAmount,
    source,
    ctx.typeNames,
  );
  const booked = {
    ...withAmount,
    credit_account: credit,
    debit_account: debit,
    organization,
  };
  if (transactionType) booked.transaction_type = transactionType;
  else delete booked.transaction_type;
  return booked;
}

function ordered(row) {
  const out = {};
  for (const field of ROW_FIELDS) {
    if (row[field] === undefined || row[field] === null) continue;
    if (
      row[field] === '' &&
      field !== 'payer' &&
      field !== 'payee' &&
      field !== 'project'
    )
      continue;
    out[field] = row[field];
  }
  return out;
}

export function buildTransactions(source, ctx, sheetRows) {
  assertLookupTables(source, ctx);
  const rawRows = sheetRows || source.transactions || [];
  const next = {
    ...source,
    transactions: rawRows.map((row) => bookRow(row, source, ctx)),
  };
  const keys = importKeys(next);
  next.transactions = next.transactions.map((row, index) =>
    ordered({ ...row, import_key: keys[index] }),
  );
  return next;
}

function sameBooking(left, right) {
  return ROW_FIELDS.every(
    (field) => (left[field] ?? '') === (right[field] ?? ''),
  );
}

function unescapeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    );
}

function xmlAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:]+)="([^"]*)"/g))
    attrs[match[1]] = unescapeXml(match[2]);
  return attrs;
}

function readZip(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip file');
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('bad zip directory');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    const data =
      method === 0
        ? compressed
        : method === 8
          ? inflateRawSync(compressed)
          : null;
    if (!data) throw new Error(`unsupported zip method ${method} in ${name}`);
    files.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function sharedStrings(xml) {
  const strings = [];
  for (const part of xml.split(/<si\b[^>]*>/).slice(1)) {
    const body = part.split(/<\/si>/)[0];
    strings.push(
      [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((match) => unescapeXml(match[1]))
        .join(''),
    );
  }
  return strings;
}

function columnIndex(letters) {
  let index = 0;
  for (const char of letters) index = index * 26 + char.charCodeAt(0) - 64;
  return index;
}

function sheetRows(xml, strings) {
  const rows = [];
  const pattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const match of xml.matchAll(pattern)) {
    const attrs = xmlAttrs(match[1]);
    const ref = /^([A-Z]+)(\d+)$/.exec(attrs.r || '');
    if (!ref) continue;
    const column = columnIndex(ref[1]);
    const rowIndex = Number(ref[2]);
    const inner = match[2] || '';
    let value = null;
    if (attrs.t === 's') {
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner);
      value = raw ? strings[Number(raw[1])] : null;
    } else if (attrs.t === 'inlineStr') {
      value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((part) => unescapeXml(part[1]))
        .join('');
    } else {
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner);
      value = raw ? unescapeXml(raw[1]) : null;
    }
    while (rows.length < rowIndex) rows.push([]);
    rows[rowIndex - 1][column] = value;
  }
  return rows;
}

export function excelDate(serial) {
  const day = Math.round(Number(serial));
  if (!Number.isFinite(day)) throw new Error(`not an Excel date: ${serial}`);
  return new Date(Date.UTC(1899, 11, 30) + day * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function excelAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error(`not an amount: ${value}`);
  return Math.round(amount * 100) / 100;
}

function cellText(value) {
  return fold(value);
}

/** Rows of the Pénzmozgások sheet, without keys or resolved accounts. */
export function readWorkbook(file) {
  const files = readZip(readFileSync(file));
  const workbook = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw new Error(`${file} has no workbook`);
  const sheet = [...workbook.toString('utf8').matchAll(/<sheet\b[^>]*>/g)]
    .map((match) => xmlAttrs(match[0]))
    .find((attrs) => attrs.name === SHEET_NAME);
  if (!sheet) throw new Error(`${file} has no "${SHEET_NAME}" sheet`);
  const relation = [...rels.toString('utf8').matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => xmlAttrs(match[0]))
    .find((attrs) => attrs.Id === sheet['r:id']);
  if (!relation) throw new Error(`no relationship for sheet "${SHEET_NAME}"`);
  const target = relation.Target.replace(/^\//, '');
  const path = target.startsWith('xl/')
    ? target
    : `xl/${target.replace(/^\.\//, '')}`;
  const sheetXml = files.get(path);
  if (!sheetXml) throw new Error(`missing ${path} in ${file}`);
  const strings = files.has('xl/sharedStrings.xml')
    ? sharedStrings(files.get('xl/sharedStrings.xml').toString('utf8'))
    : [];
  const rows = sheetRows(sheetXml.toString('utf8'), strings);
  const header = rows[0] || [];
  const expected = [
    [COL.date, 'Date'],
    [COL.credit, 'credit_Account'],
    [COL.debit, 'Debit_account'],
    [COL.project, 'Organization/Projekt'],
    [COL.amount, 'Amount'],
  ];
  for (const [column, name] of expected) {
    if (
      fold(header[column]).toLocaleLowerCase('hu') !==
      fold(name).toLocaleLowerCase('hu')
    ) {
      throw new Error(
        `column ${column} is "${header[column] ?? ''}", expected "${name}"`,
      );
    }
  }
  const transactions = [];
  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index] || [];
    const empty = ![
      COL.date,
      COL.payer,
      COL.credit,
      COL.debit,
      COL.amount,
    ].some((column) => cellText(cells[column]));
    if (empty) continue;
    const rowNumber = index + 1;
    if (!cellText(cells[COL.date]))
      throw new Error(`row ${rowNumber} has no date`);
    if (!cellText(cells[COL.credit]) || !cellText(cells[COL.debit])) {
      throw new Error(
        `row ${rowNumber} has no credit_Account or Debit_account`,
      );
    }
    transactions.push({
      row: rowNumber,
      date: excelDate(cells[COL.date]),
      payer: cellText(cells[COL.payer]),
      payee: cellText(cells[COL.payee]),
      ledger: cellText(cells[COL.ledger]),
      project: cellText(cells[COL.project]),
      purpose: cellText(cells[COL.purpose]),
      operation: cellText(cells[COL.operation]),
      amount: excelAmount(cells[COL.amount]),
      place: cellText(cells[COL.place]),
      description: String(cells[COL.description] ?? '')
        .normalize('NFC')
        .trim(),
      credit_label: cellText(cells[COL.credit]),
      debit_label: cellText(cells[COL.debit]),
    });
  }
  return transactions;
}

function loadContext(transactionsFile) {
  const dir = dirname(transactionsFile);
  const accounts = JSON.parse(
    readFileSync(resolve(dir, 'accounts.json'), 'utf8'),
  );
  const organizations = JSON.parse(
    readFileSync(resolve(dir, 'organizations.json'), 'utf8'),
  );
  const types = JSON.parse(
    readFileSync(resolve(dir, 'transaction-types.json'), 'utf8'),
  );
  return {
    accountNames: new Set(accounts.accounts.map((account) => account.name)),
    orgNames: new Set(organizations.map((organization) => organization.name)),
    typeNames: new Set(types.map((type) => type.name)),
  };
}

function parseArgs(argv) {
  let check = false;
  let xlsx = null;
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      check = true;
      continue;
    }
    if (arg === '--xlsx') {
      xlsx = argv[index + 1];
      index += 1;
      if (!xlsx) throw new Error('--xlsx needs a file');
      continue;
    }
    if (arg.startsWith('--xlsx=')) {
      xlsx = arg.slice('--xlsx='.length);
      continue;
    }
    rest.push(arg);
  }
  return { check, xlsx, file: rest[0] };
}

function main(argv) {
  const args = parseArgs(argv);
  const file = resolve(
    args.file || 'database/seeders/http/kor/data/transactions.json',
  );
  const source = JSON.parse(readFileSync(file, 'utf8'));
  const ctx = loadContext(file);
  let sheetRows;
  if (args.xlsx) {
    try {
      sheetRows = readWorkbook(resolve(args.xlsx));
    } catch (error) {
      console.error(`${args.xlsx}: ${error.message}`);
      process.exit(1);
    }
  }
  let next;
  try {
    next = buildTransactions(source, ctx, sheetRows);
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exit(1);
  }
  const current = source.transactions || [];
  const stale = next.transactions.filter(
    (row, index) => !current[index] || !sameBooking(current[index], row),
  );
  const drifted =
    stale.length > 0 || current.length !== next.transactions.length;
  const fields = source.import_key_fields.join(', ');
  if (args.check) {
    if (drifted) {
      console.error(
        `${Math.max(stale.length, Math.abs(current.length - next.transactions.length))} of ${next.transactions.length} rows are missing or stale (fields: ${fields}) in ${file}`,
      );
      process.exit(1);
    }
    console.log(
      `${next.transactions.length} import rows ok (fields: ${fields}) in ${file}`,
    );
    return;
  }
  source.transactions = next.transactions;
  writeFileSync(file, JSON.stringify(source, null, 2) + '\n');
  const aliases = new Map();
  for (const row of next.transactions) {
    for (const [label, account] of [
      [row.credit_label, row.credit_account],
      [row.debit_label, row.debit_account],
    ]) {
      if (fold(label) !== fold(account) && !/^(tag|saját):/.test(account)) {
        const key = `${label} → ${account}`;
        aliases.set(key, (aliases.get(key) || 0) + 1);
      }
    }
  }
  const aliasText =
    [...aliases.entries()]
      .map(([key, count]) => `${key} ×${count}`)
      .join('; ') || 'none';
  let amountUpdates = 0;
  let keyUpdates = 0;
  for (let index = 0; index < next.transactions.length; index += 1) {
    const cur = current[index];
    const nxt = next.transactions[index];
    if (!cur) continue;
    if (Number(cur.amount) !== Number(nxt.amount)) amountUpdates += 1;
    if (cur.import_key !== nxt.import_key) keyUpdates += 1;
  }
  console.log(
    `${next.transactions.length} rows, ${stale.length} booking drift (fields: ${fields}) in ${file}`,
  );
  console.log(`${amountUpdates} amounts, ${keyUpdates} import_keys updated`);
  console.log(`aliases: ${aliasText}`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2));
}
