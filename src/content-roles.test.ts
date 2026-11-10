import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contentRoleActions } from './content-roles.ts';

const DELETE_TX = 'api::transaction.transaction.delete';
const DELETE_RECEIPT = 'api::receipt.receipt.delete';
const PURGE = 'api::transaction.transaction.purgeExpansion';
const DISCARD = 'api::transaction.transaction.discardDraft';
const CONVERT = 'api::transaction-workflow.transaction-workflow.convert';

describe('contentRoleActions', () => {
  it('dataentry has no editor or delete actions', () => {
    const actions = contentRoleActions('dataentry');
    assert.ok(actions.includes('api::transaction.transaction.create'));
    for (const action of [DISCARD, CONVERT, DELETE_TX, DELETE_RECEIPT, PURGE]) {
      assert.equal(actions.includes(action), false, action);
    }
  });

  it('editor has convert and discard but no delete', () => {
    const actions = contentRoleActions('editor');
    assert.ok(actions.includes(DISCARD));
    assert.ok(actions.includes(CONVERT));
    for (const action of [DELETE_TX, DELETE_RECEIPT, PURGE]) {
      assert.equal(actions.includes(action), false, action);
    }
  });

  it('controller is a superset of editor plus delete and purgeExpansion', () => {
    const editor = contentRoleActions('editor');
    const controller = contentRoleActions('controller');
    for (const action of editor) {
      assert.ok(controller.includes(action), action);
    }
    for (const action of [DELETE_TX, DELETE_RECEIPT, PURGE]) {
      assert.ok(controller.includes(action), action);
    }
  });
});
