'use strict';

/**
 * Widen currency_rates.rate from numeric(10,2) to numeric(10,4).
 * Strapi defaults decimal columns to (10,2); schema `scale` alone is ignored.
 *
 * Idempotent: skips missing table/column and already-wide columns.
 * DDL uses inlined numeric(10, 4) — knex value binds are invalid in ALTER TYPE.
 */

const TARGET_PRECISION = 10;
const TARGET_SCALE = 4;
const TABLE = 'currency_rates';
const COLUMN = 'rate';

module.exports = {
  async up(knex) {
    if (!(await knex.schema.hasTable(TABLE))) {
      return;
    }
    if (!(await knex.schema.hasColumn(TABLE, COLUMN))) {
      return;
    }

    const meta = await knex
      .select('data_type', 'numeric_precision', 'numeric_scale')
      .from('information_schema.columns')
      .where({
        table_schema: 'public',
        table_name: TABLE,
        column_name: COLUMN,
      })
      .first();

    if (!meta) {
      return;
    }

    const precision = Number(meta.numeric_precision);
    const scale = Number(meta.numeric_scale);
    if (
      String(meta.data_type || '').toLowerCase() === 'numeric' &&
      precision >= TARGET_PRECISION &&
      scale >= TARGET_SCALE
    ) {
      return;
    }

    await knex.raw(`
      ALTER TABLE ${TABLE}
      ALTER COLUMN ${COLUMN} TYPE numeric(${TARGET_PRECISION}, ${TARGET_SCALE})
      USING ${COLUMN}::numeric(${TARGET_PRECISION}, ${TARGET_SCALE})
    `);
  },
  async down() {
    // Down migrations are not used for this type widen.
  },
};
