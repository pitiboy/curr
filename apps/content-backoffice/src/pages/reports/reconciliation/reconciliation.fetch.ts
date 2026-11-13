import { STRAPI_URL } from '../../../config';
import type { ContentHttpClient } from '../../../data/receiptDraft';
import type { ReconciliationReport } from './types';

export async function fetchReconciliationReport(
  httpClient: ContentHttpClient,
): Promise<ReconciliationReport> {
  const { json } = (await httpClient(
    `${STRAPI_URL}/api/backoffice/reconciliation`,
  )) as { json: ReconciliationReport };
  return json;
}
