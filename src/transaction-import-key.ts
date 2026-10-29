/**
 * DB-level guard for the Excel entered_key of transactions.
 *
 * Strapi 5 `unique: true` is only checked in the app, and never for drafts,
 * while the seeder creates drafts. A plain unique index would also break
 * draft & publish, because the published row repeats the draft's value.
 * Every document has exactly one draft row, so a partial unique index on the
 * draft rows allows one document per entered_key. Rows without a key (manual
 * entries) are not indexed. Schema sync does not drop unknown indexes unless
 * forceMigration is on; the index is still re-ensured on every boot.
 */
export const TRANSACTION_ENTERED_KEY_INDEX =
  'transactions_entered_key_draft_uq';

/** Previous name before import_key → entered_key rename. */
const LEGACY_IMPORT_KEY_INDEX = 'transactions_import_key_draft_uq';

export const TRANSACTION_ENTERED_KEY_INDEX_SQL =
  `CREATE UNIQUE INDEX IF NOT EXISTS ${TRANSACTION_ENTERED_KEY_INDEX} ` +
  'ON transactions (entered_key) ' +
  'WHERE published_at IS NULL AND entered_key IS NOT NULL';

type StrapiDbLike = {
  db: {
    dialect?: { client?: string };
    config?: { connection?: { client?: string } };
    connection: { raw: (sql: string) => Promise<unknown> };
  };
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
};

export async function ensureTransactionImportKeyIndex(strapi: StrapiDbLike) {
  const client =
    strapi.db.dialect?.client || strapi.db.config?.connection?.client || '';
  if (client !== 'postgres' && client !== 'sqlite') {
    strapi.log.warn(
      `Transaction entered_key index skipped: partial unique index not supported on "${client}"`,
    );
    return;
  }
  try {
    await strapi.db.connection.raw(
      `DROP INDEX IF EXISTS ${LEGACY_IMPORT_KEY_INDEX}`,
    );
    await strapi.db.connection.raw(TRANSACTION_ENTERED_KEY_INDEX_SQL);
  } catch (error) {
    // Existing duplicate draft keys must be cleaned up by hand; do not block boot.
    strapi.log.error(
      `Transaction entered_key index could not be created: ${(error as Error).message}`,
    );
  }
}
