'use strict';

/**
 * Remap experimental role labels on transactions.converted_to_workflow
 * (original / storno / expanded) to boolean-castable strings before schema
 * sync alters the column to boolean. Idempotent: no-op when the table/column
 * is missing or the column is already boolean.
 */
module.exports = {
  async up(knex) {
    const hasTable = await knex.schema.hasTable('transactions');
    if (!hasTable) {
      return;
    }

    const hasColumn = await knex.schema.hasColumn('transactions', 'converted_to_workflow');
    if (!hasColumn) {
      return;
    }

    const column = await knex
      .select('data_type', 'udt_name')
      .from('information_schema.columns')
      .where({
        table_schema: 'public',
        table_name: 'transactions',
        column_name: 'converted_to_workflow',
      })
      .first();

    if (!column) {
      return;
    }

    const type = String(column.data_type || '').toLowerCase();
    const udt = String(column.udt_name || '').toLowerCase();
    if (type === 'boolean' || udt === 'bool') {
      return;
    }

    await knex.raw(`
      UPDATE transactions
      SET converted_to_workflow = CASE
        WHEN converted_to_workflow IS NULL OR btrim(converted_to_workflow::text) = '' THEN 'false'
        WHEN lower(btrim(converted_to_workflow::text)) IN ('true', 't', '1', 'false', 'f', '0')
          THEN lower(btrim(converted_to_workflow::text))
        ELSE 'true'
      END
    `);
  },
  async down() {
    // Down migrations are not used for this data remap.
  },
};
