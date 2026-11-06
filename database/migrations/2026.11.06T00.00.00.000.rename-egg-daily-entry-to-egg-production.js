'use strict';

/**
 * Rename Settings (backoffice_features) workflow key
 * `egg-daily-entry` → `egg-production`.
 *
 * Idempotent:
 * - no table / no old row → no-op
 * - both keys present → merge enabled (OR), keep new config when set, delete old
 * - only old row → UPDATE key
 */

const TABLE = 'backoffice_features';
const OLD_KEY = 'egg-daily-entry';
const NEW_KEY = 'egg-production';

module.exports = {
  async up(knex) {
    if (!(await knex.schema.hasTable(TABLE))) {
      return;
    }
    if (!(await knex.schema.hasColumn(TABLE, 'key'))) {
      return;
    }

    const oldRow = await knex(TABLE).where({ key: OLD_KEY }).first();
    if (!oldRow) {
      return;
    }

    const newRow = await knex(TABLE).where({ key: NEW_KEY }).first();
    if (newRow) {
      const patch = {
        enabled: Boolean(oldRow.enabled) || Boolean(newRow.enabled),
      };
      if (newRow.config == null && oldRow.config != null) {
        patch.config = oldRow.config;
      }
      if (await knex.schema.hasColumn(TABLE, 'updated_at')) {
        patch.updated_at = knex.fn.now();
      }
      await knex(TABLE).where({ key: NEW_KEY }).update(patch);
      await knex(TABLE).where({ key: OLD_KEY }).del();
      return;
    }

    const rename = { key: NEW_KEY };
    if (await knex.schema.hasColumn(TABLE, 'updated_at')) {
      rename.updated_at = knex.fn.now();
    }
    await knex(TABLE).where({ key: OLD_KEY }).update(rename);
  },
  async down() {
    // Down migrations are not used for this key rename.
  },
};
