/**
 * Users & Permissions content roles: dataentry, editor, controller.
 * The bootstrap (`src/index.ts`) grants these Content API actions additively.
 */

/** Auth actions not returned by getActions() but required for Content users. */
export const CONTENT_ROLE_AUTH_ACTIONS = [
  'plugin::users-permissions.auth.changePassword',
] as const;

/** Content API actions shared by every content role (no delete). */
export const CONTENT_ROLE_ACTIONS = [
  'api::transaction.transaction.find',
  'api::transaction.transaction.findOne',
  'api::transaction.transaction.create',
  'api::transaction.transaction.update',
  'api::receipt.receipt.find',
  'api::receipt.receipt.findOne',
  'api::receipt.receipt.create',
  'api::receipt.receipt.update',
  'api::organization.organization.find',
  'api::organization.organization.findOne',
  'api::account.account.find',
  'api::account.account.findOne',
  'api::currency-type.currency-type.find',
  'api::currency-type.currency-type.findOne',
  'api::currency-rate.currency-rate.find',
  'api::currency-rate.currency-rate.findOne',
  'api::member.member.find',
  'api::member.member.findOne',
  'api::membership.membership.find',
  'api::membership.membership.findOne',
  'api::membership-type.membership-type.find',
  'api::membership-type.membership-type.findOne',
  'api::transaction-type.transaction-type.find',
  'api::transaction-type.transaction-type.findOne',
  'api::receipt-type.receipt-type.find',
  'api::receipt-type.receipt-type.findOne',
  'plugin::upload.content-api.upload',
  'plugin::users-permissions.user.me',
  'api::backoffice.backoffice.config',
  'api::transaction-workflow.transaction-workflow.find',
  'api::transaction-workflow.transaction-workflow.findOne',
] as const;

export const EDITOR_ONLY_CONTENT_ACTIONS = [
  'api::transaction.transaction.discardDraft',
  'api::transaction-workflow.transaction-workflow.convert',
  'api::transaction-workflow.transaction-workflow.convertPreview',
] as const;

/** Editor-like roles: full editor workflow (publish via guard, convert, discard). */
export const EDITOR_LIKE_ROLE_TYPES = ['editor', 'controller'] as const;

/** Controller extras on top of the editor set: general delete + purge-expansion. */
export const CONTROLLER_ONLY_CONTENT_ACTIONS = [
  'api::transaction.transaction.delete',
  'api::transaction.transaction.purgeExpansion',
  'api::receipt.receipt.delete',
] as const;

/** Content API actions granted to a role type by the bootstrap. */
export function contentRoleActions(roleType: string): string[] {
  const editorLike = (EDITOR_LIKE_ROLE_TYPES as readonly string[]).includes(
    roleType,
  );
  return [
    ...CONTENT_ROLE_ACTIONS,
    ...CONTENT_ROLE_AUTH_ACTIONS,
    ...(editorLike ? EDITOR_ONLY_CONTENT_ACTIONS : []),
    ...(roleType === 'controller' ? CONTROLLER_ONLY_CONTENT_ACTIONS : []),
  ];
}
