import { strapiHttpClient } from 'ra-strapi';
import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from 'react-admin';

import { STRAPI_URL } from '../config';
import { fetchPublishedWorkflows } from '../data/transactionWorkflow';
import {
  pickMatchingWorkflow,
  type TransactionWorkflowMatchInput,
  type WorkflowTemplateHeader,
} from '../data/transactionList';

const httpClient = strapiHttpClient({ storage: localStorage });

let cachedWorkflows: WorkflowTemplateHeader[] | null = null;
let inflight: Promise<WorkflowTemplateHeader[]> | null = null;

function loadCatalog(): Promise<WorkflowTemplateHeader[]> {
  if (cachedWorkflows) return Promise.resolve(cachedWorkflows);
  if (!inflight) {
    inflight = fetchPublishedWorkflows(httpClient, STRAPI_URL)
      .then((rows) => {
        cachedWorkflows = rows;
        return rows;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Clears the session cache (e.g. after deploy or manual refresh). */
export function invalidateTransactionWorkflowCatalog(): void {
  cachedWorkflows = null;
}

export function useTransactionWorkflowCatalog() {
  const { permissions, isPending } = usePermissions();
  const isEditor = !isPending && permissions === 'editor';
  const [workflows, setWorkflows] = useState<WorkflowTemplateHeader[]>(
    isEditor && cachedWorkflows ? cachedWorkflows : [],
  );
  const [loading, setLoading] = useState(isEditor && !cachedWorkflows);

  useEffect(() => {
    if (!isEditor) {
      setWorkflows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(!cachedWorkflows);
    void loadCatalog()
      .then((rows) => {
        if (!cancelled) setWorkflows(rows);
      })
      .catch(() => {
        if (!cancelled) setWorkflows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditor]);

  const matchFor = useMemo(
    () => (transaction: TransactionWorkflowMatchInput) =>
      pickMatchingWorkflow(workflows, transaction),
    [workflows],
  );

  return { workflows, loading, matchFor, isEditor };
}
