import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermissions } from 'react-admin';

import { fetchWorkflowCatalog } from '../../data/dataProvider';
import {
  matchingWorkflows,
  pickMatchingWorkflow,
  type WorkflowMatchSubject,
  type WorkflowTemplate,
} from '../../data/transactionList';
import {
  createWorkflowCatalogLoader,
  loadCatalogForRole,
  NO_WORKFLOWS,
} from '../../data/transactionWorkflowCatalog';

/** One cache for the whole session; every screen shares the single request. */
const catalogLoader = createWorkflowCatalogLoader(fetchWorkflowCatalog);

/**
 * Published `transaction-workflow` templates for the Convert buttons.
 * Editor only: other roles never trigger the request and `matchFor` stays null.
 */
export function useTransactionWorkflowCatalog() {
  const { permissions, isPending } = usePermissions();
  const isEditor = !isPending && permissions === 'editor';
  const [loaded, setLoaded] =
    useState<readonly WorkflowTemplate[]>(NO_WORKFLOWS);

  useEffect(() => {
    if (!isEditor) return;
    let cancelled = false;
    loadCatalogForRole(permissions, catalogLoader)
      .then((workflows) => {
        if (!cancelled) setLoaded(workflows);
      })
      .catch(() => {
        // No catalog, no button. The loader retries on the next screen.
      });
    return () => {
      cancelled = true;
    };
  }, [isEditor, permissions]);

  const workflows = isEditor ? loaded : NO_WORKFLOWS;

  /** The one template for a row or form snapshot, else null. */
  const matchFor = useCallback(
    (subject: WorkflowMatchSubject): WorkflowTemplate | null =>
      pickMatchingWorkflow(workflows, subject),
    [workflows],
  );

  /** More than one template fits: no button, but the editor can be told. */
  const isAmbiguous = useCallback(
    (subject: WorkflowMatchSubject): boolean =>
      matchingWorkflows(workflows, subject).length > 1,
    [workflows],
  );

  return useMemo(
    () => ({ isEditor, matchFor, isAmbiguous }),
    [isEditor, matchFor, isAmbiguous],
  );
}

export type TransactionWorkflowCatalog = ReturnType<
  typeof useTransactionWorkflowCatalog
>;
