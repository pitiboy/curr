'use strict';

/**
 * Cast transaction_workflows debit/credit_account_code from integer to text
 * so glob/regex match patterns (e.g. 5*, 15[23]0) can be stored.
 *
 * Idempotent: no-op when the table/column is missing or already text/varchar.
 */

const TABLE = 'transaction_workflows';
const COLUMNS = ['debit_account_code', 'credit_account_code'];

module.exports = {
  async up(knex) {
    if (!(await knex.schema.hasTable(TABLE))) {
      return;
    }

    for (const columnName of COLUMNS) {
      if (!(await knex.schema.hasColumn(TABLE, columnName))) {
        continue;
      }

      const column = await knex
        .select('data_type', 'udt_name')
        .from('information_schema.columns')
        .where({
          table_schema: 'public',
          table_name: TABLE,
          column_name: columnName,
        })
        .first();

      if (!column) {
        continue;
      }

      const type = String(column.data_type || '').toLowerCase();
      const udt = String(column.udt_name || '').toLowerCase();
      if (
        type === 'text' ||
        type === 'character varying' ||
        udt === 'text' ||
        udt === 'varchar'
      ) {
        continue;
      }

      await knex.raw(
        `ALTER TABLE ?? ALTER COLUMN ?? TYPE text USING ??::text`,
        [TABLE, columnName, columnName],
      );
    }
  },
  async down() {
    // Down migrations are not used for this type widen.
  },
};
