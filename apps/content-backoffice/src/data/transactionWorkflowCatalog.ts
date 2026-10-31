import type { WorkflowTemplate } from './transactionList';

type Fetcher = () => Promise<WorkflowTemplate[]>;

/** Shared empty list, so an unchanged catalog keeps one array identity. */
export const NO_WORKFLOWS: readonly WorkflowTemplate[] = [];

/**
 * Session cache for the published templates: one request however many
 * screens or rows ask. A failed load is not cached, so the next ask retries.
 */
export function createWorkflowCatalogLoader(fetchAll: Fetcher) {
  let pending: Promise<WorkflowTemplate[]> | null = null;
  return {
    load(): Promise<WorkflowTemplate[]> {
      if (!pending) {
        pending = fetchAll().catch((error: unknown) => {
          pending = null;
          throw error;
        });
      }
      return pending;
    },
    reset(): void {
      pending = null;
    },
  };
}

export type WorkflowCatalogLoader = ReturnType<
  typeof createWorkflowCatalogLoader
>;

/**
 * Only `editor` reads the catalog (the Convert action is editor-only on the
 * server). Any other role gets an empty list and no request is made.
 */
export async function loadCatalogForRole(
  permissions: unknown,
  loader: Pick<WorkflowCatalogLoader, 'load'>,
): Promise<readonly WorkflowTemplate[]> {
  if (permissions !== 'editor') return NO_WORKFLOWS;
  return loader.load();
}
