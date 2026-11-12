#!/usr/bin/env node
/**
 * One-shot refresh of kor transactions.json for the current workflow headers.
 * Heuristics + schema validation — no Excel.
 *
 *   node scripts/refresh-kor-transactions-for-workflows.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fold } from '../database/seeders/transaction-import-keys.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'database/seeders/http/kor/data');

/** Same dual-mode helper as src/transaction-workflow/convert.ts (glob * / ? or regex). */
function accountCodeMatchesPattern(code, pattern) {
  if (code == null || code === '' || pattern == null || pattern === '') {
    return false;
  }
  const codeStr = String(code).trim();
  const patternStr = String(pattern).trim();
  if (!codeStr || !patternStr) return false;
  const useRegex = /[[\](){}\\.^$|+]/.test(patternStr);
  const body = useRegex
    ? patternStr
    : patternStr.replace(/\*/g, '[0-9]*').replace(/\?/g, '[0-9]');
  try {
    return new RegExp(`^${body}$`).test(codeStr);
  } catch {
    return false;
  }
}

const workflows = [
  {
    name: '01-tagi-befizetes-projekt-lekotesre',
    debit: '5?00',
    credit: '1101',
    type: 'Részjegy',
  },
  {
    name: '03-tagi-lekotes-projekt-anyag',
    debit: '5(00|10|4[0-9]|50|80)0',
    credit: '1101',
    type: 'Lekötés',
  },
  {
    name: '02-tagi-lekotes-ingatlan',
    debit: '15[12]0',
    credit: '1101',
    type: 'Lekötés',
  },
  {
    name: '11-banyaszas-bankszamla',
    debit: '1001',
    credit: '1100',
    type: 'Bányászás',
  },
  {
    name: '12-banyaszas-keszpenz',
    debit: '1001',
    credit: '1000',
    type: 'Bányászás',
  },
  {
    name: '01-tagi-befizetes-szabad',
    debit: '1100',
    credit: '1101',
    type: 'Részjegy',
  },
];

const ORG_FINANCE = 'I/3. Pénzügyi Igazgatóság';
const ORG_FOUNDERS = 'I/0.1 Alapító(k)';
const MAIN = 'Zöld források szövetkezet @Szupatak';

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf8'));
}

function accountCode(ref, nameToCode) {
  if (!ref) return null;
  if (ref.startsWith('tag:')) return '1101';
  if (ref.startsWith('saját:')) return '1001';
  return nameToCode.get(ref) || null;
}

function canonicalType(name, typeNames) {
  if (!name) return null;
  const found = [...typeNames].find((t) => fold(t) === fold(name));
  if (!found) throw new Error(`unknown transaction_type "${name}"`);
  return found;
}

function placeType(place) {
  const p = fold(place).toLocaleLowerCase('hu');
  if (p === 'kp') return 'Készpénz';
  if (p === 'utalás' || p === 'k&h') return 'Utalás';
  // City / office names on Homály költségek → cash.
  if (place) return 'Készpénz';
  return null;
}

function descriptionHints(row) {
  const text = fold(row.description).toLocaleLowerCase('hu');
  return {
    bejegyzes: text.includes('bejegyz'),
    szovetkezetiDij:
      text.includes('szövetkezeti díj') || text.includes('tagi hozzájárul'),
    kolcson: text.includes('kölcsön'),
    kamat: text.includes('kamat'),
    bankFee:
      text.includes('e-bank') ||
      text.includes('csomagdíj') ||
      text.includes('könyvelési') ||
      text.includes('simplep') ||
      text.includes('voxpay') ||
      text.includes('nemzeti agrár'),
  };
}

/**
 * Prefer the typed workflow the row is meant to expand into.
 * 5xxx←1101: Részjegy beats Lekötés when purpose/op/desc look like share capital.
 * 15xx←1101: Lekötés (ingatlan lekötés templates).
 */
function workflowType(debit, credit, row) {
  const purpose = fold(row.purpose);
  const operation = fold(row.operation);
  const desc = fold(row.description).toLocaleLowerCase('hu');
  const looksReszjegy =
    purpose === 'Részjegy' ||
    operation === 'Részjegy' ||
    operation === 'Befizetés' ||
    desc.includes('részjegy') ||
    desc.includes('bejegyz');

  if (
    accountCodeMatchesPattern(debit, '15[12]0') &&
    accountCodeMatchesPattern(credit, '1101')
  ) {
    return 'Lekötés';
  }
  if (
    accountCodeMatchesPattern(debit, '5(00|10|4[0-9]|50|80)0') &&
    accountCodeMatchesPattern(credit, '1101')
  ) {
    return looksReszjegy ? 'Részjegy' : 'Lekötés';
  }
  if (
    accountCodeMatchesPattern(debit, '1100') &&
    accountCodeMatchesPattern(credit, '1101')
  ) {
    return 'Részjegy';
  }
  if (
    accountCodeMatchesPattern(debit, '1001') &&
    (accountCodeMatchesPattern(credit, '1100') ||
      accountCodeMatchesPattern(credit, '1000'))
  ) {
    return 'Bányászás';
  }
  return null;
}

function heuristicType(row, debit, credit) {
  const fromWf = workflowType(debit, credit, row);
  if (fromWf) return fromWf;

  // Internal 1101↔1001 / stróman támogatás 1001←4200.
  if (debit === '1101' && credit === '1001') return 'Átvezetés';
  if (credit === '1101' && debit === '1001') return 'Átvezetés';
  if (debit === '1001' && credit === '4200') return 'Utalás';
  if (debit === '1101' && credit === '4200') return 'Utalás';

  const fromOp =
    row.operation === 'Bányászás'
      ? 'Bányászás'
      : row.operation === 'Részjegy'
        ? 'Részjegy'
        : null;
  if (fromOp) return fromOp;

  const fromPlace = placeType(row.place);
  if (fromPlace) return fromPlace;

  if (fold(row.purpose) === 'Részjegy') return 'Részjegy';
  return null;
}

function heuristicOrg(row, debit, credit, currentOrg) {
  const hints = descriptionHints(row);
  const purpose = fold(row.purpose);
  const operation = fold(row.operation);

  // Keep a concrete org node when already set (not the catch-all root).
  if (currentOrg && currentOrg !== MAIN) return currentOrg;

  if (
    accountCodeMatchesPattern(debit, '1001') &&
    (accountCodeMatchesPattern(credit, '1100') ||
      accountCodeMatchesPattern(credit, '1000'))
  ) {
    return ORG_FINANCE;
  }

  if (hints.bejegyzes && purpose === 'Részjegy') return ORG_FOUNDERS;
  if (hints.szovetkezetiDij || hints.kolcson || hints.kamat || hints.bankFee) {
    return ORG_FINANCE;
  }
  if (operation === 'Kamat' || operation === 'Kölcsön') return ORG_FINANCE;
  if (operation === 'Bányászás') return ORG_FINANCE;

  // Member share paid into cash/bank still under finance.
  if (
    purpose === 'Részjegy' &&
    accountCodeMatchesPattern(credit, '1101') &&
    (debit === '1000' || debit === '1100')
  ) {
    return ORG_FINANCE;
  }

  return currentOrg || MAIN;
}

function main() {
  const source = loadJson('transactions.json');
  const accounts = loadJson('accounts.json').accounts;
  const organizations = loadJson('organizations.json');
  const types = loadJson('transaction-types.json');

  const nameToCode = new Map(accounts.map((a) => [a.name, String(a.code)]));
  const orgNames = new Set(organizations.map((o) => o.name));
  const typeNames = new Set(types.map((t) => t.name));

  let typeFilled = 0;
  let typeChanged = 0;
  let orgChanged = 0;
  let currencyFilled = 0;

  const nextRows = source.transactions.map((row) => {
    const debit = accountCode(row.debit_account, nameToCode);
    const credit = accountCode(row.credit_account, nameToCode);
    if (!debit || !credit) {
      throw new Error(
        `row ${row.row}: unresolved account T=${row.debit_account} K=${row.credit_account}`,
      );
    }
    if (!row.organization || !orgNames.has(row.organization)) {
      throw new Error(
        `row ${row.row}: invalid organization ${JSON.stringify(row.organization)}`,
      );
    }

    const wantedType = canonicalType(
      heuristicType(row, debit, credit),
      typeNames,
    );
    const next = { ...row };

    if (!next.currency) {
      next.currency = source.currencyCode || 'HUF';
      currencyFilled += 1;
    }

    if (wantedType) {
      if (!next.transaction_type) {
        next.transaction_type = wantedType;
        typeFilled += 1;
      } else if (next.transaction_type !== wantedType) {
        // Only override place-based payment types when a typed workflow applies.
        const wfDriven = Boolean(workflowType(debit, credit, row));
        const paymentOnly = ['Készpénz', 'Utalás'].includes(
          next.transaction_type,
        );
        if (wfDriven && paymentOnly) {
          next.transaction_type = wantedType;
          typeChanged += 1;
        }
      }
    }

    const org = heuristicOrg(row, debit, credit, next.organization);
    if (!orgNames.has(org)) {
      throw new Error(`row ${row.row}: heuristic org not in seed: ${org}`);
    }
    if (org !== next.organization) {
      next.organization = org;
      orgChanged += 1;
    }

    return next;
  });

  // Schema / seed validation
  const missingType = nextRows.filter((r) => !r.transaction_type);
  if (missingType.length) {
    throw new Error(
      `${missingType.length} rows still lack transaction_type: ${missingType
        .map((r) => r.row)
        .join(', ')}`,
    );
  }
  for (const row of nextRows) {
    for (const field of [
      'date',
      'amount',
      'description',
      'credit_account',
      'debit_account',
      'organization',
      'currency',
      'transaction_type',
      'entered_key',
    ]) {
      if (
        row[field] === undefined ||
        row[field] === null ||
        row[field] === ''
      ) {
        throw new Error(`row ${row.row}: missing ${field}`);
      }
    }
    if (!orgNames.has(row.organization)) {
      throw new Error(`row ${row.row}: bad org`);
    }
    if (!typeNames.has(row.transaction_type)) {
      throw new Error(`row ${row.row}: bad type`);
    }
  }

  // Workflow match summary (account + type)
  const matchCounts = Object.fromEntries(workflows.map((w) => [w.name, 0]));
  for (const row of nextRows) {
    const debit = accountCode(row.debit_account, nameToCode);
    const credit = accountCode(row.credit_account, nameToCode);
    for (const w of workflows) {
      if (
        accountCodeMatchesPattern(debit, w.debit) &&
        accountCodeMatchesPattern(credit, w.credit) &&
        row.transaction_type === w.type
      ) {
        matchCounts[w.name] += 1;
      }
    }
  }

  source.transactions = nextRows;
  writeFileSync(
    resolve(dataDir, 'transactions.json'),
    JSON.stringify(source, null, 2) + '\n',
  );

  console.log(
    `updated: typeFilled=${typeFilled} typeChanged=${typeChanged} orgChanged=${orgChanged} currencyFilled=${currencyFilled}`,
  );
  console.log('workflow matches (account+type):', matchCounts);
}

main();
