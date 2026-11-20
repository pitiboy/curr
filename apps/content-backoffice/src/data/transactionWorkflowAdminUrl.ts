/** Strapi 5 Content Manager UID for transaction workflows. */
export const TRANSACTION_WORKFLOW_COLLECTION_UID =
  'api::transaction-workflow.transaction-workflow' as const;

/**
 * Direct Strapi admin edit URL for a published workflow template.
 * Returns null when `documentId` or admin base URL is missing.
 */
export function transactionWorkflowAdminEditUrl(
  adminBaseUrl: string | null | undefined,
  documentId: string | null | undefined,
): string | null {
  const base = adminBaseUrl?.trim().replace(/\/+$/, '') ?? '';
  const id = typeof documentId === 'string' ? documentId.trim() : '';
  if (!base || !id) return null;
  return `${base}/content-manager/collection-types/${TRANSACTION_WORKFLOW_COLLECTION_UID}/${encodeURIComponent(id)}`;
}
