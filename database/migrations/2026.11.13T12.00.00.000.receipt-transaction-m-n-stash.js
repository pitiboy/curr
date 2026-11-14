'use strict';

const STASH_TABLE = 'receipt_transaction_links_stash';
const OLD_LINK_TABLE = 'receipts_transaction_lnk';

/**
 * Before schema sync replaces receipt.transaction (manyToOne) with
 * transaction.receipts (manyToMany), copy existing join rows into a stash
 * table. {@link restoreReceiptTransactionLinksFromStash} runs on bootstrap.
 */
module.exports = {
  async up(knex) {
    const hasReceipts = await knex.schema.hasTable('receipts');
    const hasTransactions = await knex.schema.hasTable('transactions');
    if (!hasReceipts || !hasTransactions) {
      return;
    }

    const hasStash = await knex.schema.hasTable(STASH_TABLE);
    if (!hasStash) {
      await knex.schema.createTable(STASH_TABLE, (table) => {
        table.integer('receipt_id').unsigned().notNullable();
        table.integer('transaction_id').unsigned().notNullable();
        table.unique(['receipt_id', 'transaction_id']);
      });
    }

    const existing = await knex(STASH_TABLE).count({ c: '*' }).first();
    if (Number(existing?.c ?? 0) > 0) {
      return;
    }

    const hasOldLink = await knex.schema.hasTable(OLD_LINK_TABLE);
    if (hasOldLink) {
      await knex(STASH_TABLE).insert(
        knex.select('receipt_id', 'transaction_id').from(OLD_LINK_TABLE),
      );
      return;
    }

    const hasFk = await knex.schema.hasColumn('receipts', 'transaction_id');
    if (hasFk) {
      await knex(STASH_TABLE).insert(
        knex
          .select({ receipt_id: 'id', transaction_id: 'transaction_id' })
          .from('receipts')
          .whereNotNull('transaction_id'),
      );
    }
  },
  async down() {
    // Data restore is forward-only via bootstrap.
  },
};
