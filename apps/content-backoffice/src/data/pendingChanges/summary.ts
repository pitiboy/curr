import type { PendingChangePayload } from './types';

export function buildPayloadSummary(payload: PendingChangePayload): string {
  if (payload.kind === 'dataProvider') {
    const params = payload.params;
    if (payload.method === 'create' || payload.method === 'update') {
      const data = params.data as Record<string, unknown> | undefined;
      const parts: string[] = [];
      if (data?.description && typeof data.description === 'string') {
        parts.push(data.description.slice(0, 60));
      }
      if (data?.amount !== undefined) parts.push(String(data.amount));
      if (parts.length > 0) return parts.join(' · ');
    }
    if (payload.method === 'delete') {
      return String(params.id ?? '');
    }
    if (payload.method === 'updateMany' || payload.method === 'deleteMany') {
      const ids = params.ids;
      return Array.isArray(ids) ? `${ids.length} sor` : '';
    }
    return payload.method;
  }
  if (payload.name === 'convertTransaction') {
    return String(payload.input.transactionDocumentId ?? '');
  }
  if (payload.name === 'createAndConvert') {
    const data = payload.input.data as Record<string, unknown> | undefined;
    const parts: string[] = [];
    if (data?.description && typeof data.description === 'string') {
      parts.push(data.description.slice(0, 60));
    }
    if (data?.amount !== undefined) parts.push(String(data.amount));
    const workflowId = payload.input.workflowDocumentId;
    if (typeof workflowId === 'string' && workflowId) {
      parts.push(`→ ${workflowId.slice(0, 8)}`);
    }
    if (parts.length > 0) return parts.join(' · ');
  }
  return '';
}
