import type { Core } from '@strapi/strapi';

const STASH_TABLE = 'receipt_transaction_links_stash';

/**
 * Stash is written by `database/migrations/*receipt-transaction-m-n-stash.js`
 * before schema sync. After sync, restore links on the new transaction-owned
 * many-to-many join table.
 */
export async function restoreReceiptTransactionLinksFromStash(
  strapi: Core.Strapi,
): Promise<void> {
  const schema = strapi.db.connection.schema;
  if (!(await schema.hasTable(STASH_TABLE))) {
    return;
  }

  const transactionMeta = strapi.db.metadata.get(
    'api::transaction.transaction',
  );
  const attr = transactionMeta?.attributes?.receipts as
    | {
        joinTable?: {
          name?: string;
          joinColumn?: { name?: string };
          inverseJoinColumn?: { name?: string };
        };
      }
    | undefined;
  const joinTable = attr?.joinTable;
  if (
    !joinTable?.name ||
    !joinTable.joinColumn?.name ||
    !joinTable.inverseJoinColumn?.name
  ) {
    strapi.log.warn(
      'receipt-transaction migration: join table metadata missing, stash kept',
    );
    return;
  }

  const knex = strapi.db.connection;
  const rows = (await knex(STASH_TABLE).select(
    'receipt_id',
    'transaction_id',
  )) as { receipt_id: number; transaction_id: number }[];

  if (rows.length === 0) {
    await knex.schema.dropTable(STASH_TABLE);
    return;
  }

  const target = joinTable.name;
  const txCol = joinTable.joinColumn.name;
  const receiptCol = joinTable.inverseJoinColumn.name;

  if (!(await schema.hasTable(target))) {
    strapi.log.warn(
      `receipt-transaction migration: ${target} missing, stash kept`,
    );
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    const exists = await knex(target)
      .where({ [receiptCol]: row.receipt_id, [txCol]: row.transaction_id })
      .first();
    if (exists) continue;
    await knex(target).insert({
      [receiptCol]: row.receipt_id,
      [txCol]: row.transaction_id,
    });
    inserted += 1;
  }

  await knex.schema.dropTable(STASH_TABLE);
  strapi.log.info(
    `receipt-transaction migration: restored ${inserted} link(s) into ${target}`,
  );
}
