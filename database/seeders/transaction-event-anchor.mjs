/**
 * Mirrors src/transaction-event-anchor.ts for seeders (no TS import in .mjs).
 */

export const DEFAULT_PRODUCTION_LEG = 'production';

export function assignRelatedEnteredKeys(rows, options = {}) {
  const sheetRowField = options.sheetRowField ?? 'sheet_row';
  const legField = options.legField ?? 'leg';
  const productionLeg = options.productionLeg ?? DEFAULT_PRODUCTION_LEG;

  const anchorBySheetRow = new Map();

  for (const row of rows) {
    const sheetRow = row[sheetRowField];
    if (typeof sheetRow !== 'number') continue;
    if (row[legField] === productionLeg) {
      anchorBySheetRow.set(sheetRow, row.entered_key);
    }
  }

  for (const row of rows) {
    const sheetRow = row[sheetRowField];
    if (typeof sheetRow !== 'number') continue;
    if (!anchorBySheetRow.has(sheetRow)) {
      anchorBySheetRow.set(sheetRow, row.entered_key);
    }
  }

  return rows.map((row) => {
    const sheetRow = row[sheetRowField];
    const anchor =
      typeof sheetRow === 'number' ? anchorBySheetRow.get(sheetRow) : undefined;
    if (!anchor || row.entered_key === anchor) {
      return { ...row, related_transaction_entered_key: null };
    }
    return { ...row, related_transaction_entered_key: anchor };
  });
}
