'use strict';

/**
 * Widen transaction/receipt amount from numeric(10,2) to numeric(18,2).
 * numeric(10,2) overflows above 99_999_999.99 (e.g. 200_022_000 HUF).
 *
 * Idempotent: skips missing tables/columns and already-wide columns.
 * DDL uses inlined numeric(18, 2) — knex value binds are invalid in ALTER TYPE.
 */

const TARGET_PRECISION = 18;
const TARGET_SCALE = 2;
const COLUMNS = [
  { table: 'transactions', column: 'amount' },
  { table: 'receipts', column: 'amount' },
];

module.exports = {
  async up(knex) {
    for (const { table, column } of COLUMNS) {
      if (!(await knex.schema.hasTable(table))) {
        continue;
      }
      if (!(await knex.schema.hasColumn(table, column))) {
        continue;
      }

      const meta = await knex
        .select('data_type', 'numeric_precision', 'numeric_scale')
        .from('information_schema.columns')
        .where({
          table_schema: 'public',
          table_name: table,
          column_name: column,
        })
        .first();

      if (!meta) {
        continue;
      }

      const precision = Number(meta.numeric_precision);
      const scale = Number(meta.numeric_scale);
      if (
        String(meta.data_type || '').toLowerCase() === 'numeric' &&
        precision >= TARGET_PRECISION &&
        scale === TARGET_SCALE
      ) {
        continue;
      }

      // Table/column names are fixed constants above — no knex binds (DDL).
      await knex.raw(`
        ALTER TABLE ${table}
        ALTER COLUMN ${column} TYPE numeric(${TARGET_PRECISION}, ${TARGET_SCALE})
        USING ${column}::numeric(${TARGET_PRECISION}, ${TARGET_SCALE})
      `);
    }
  },
  async down() {
    // Down migrations are not used for this type widen.
  },
};
