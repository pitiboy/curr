'use strict';

/**
 * Widen receipt/asset money columns to numeric(18,4).
 * Strapi defaults decimal columns to (10,2); schema `scale` alone is ignored.
 *
 * Idempotent: skips missing tables/columns and already-wide columns.
 * DDL uses inlined numeric(18, 4) — knex value binds are invalid in ALTER TYPE.
 */

const TARGET_PRECISION = 18;
const TARGET_SCALE = 4;
const COLUMNS = [
  { table: 'receipts', column: 'amount' },
  { table: 'assets', column: 'purchase_price' },
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
        scale >= TARGET_SCALE
      ) {
        continue;
      }

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
