import { describe, expect, it } from 'vitest';

import {
  TRANSACTION_WORKFLOW_COLLECTION_UID,
  transactionWorkflowAdminEditUrl,
} from './transactionWorkflowAdminUrl';

describe('transactionWorkflowAdminEditUrl', () => {
  it('builds Strapi 5 admin edit URL from documentId', () => {
    const url = transactionWorkflowAdminEditUrl(
      'http://localhost:1337/admin',
      'wf-doc-abc',
    );
    expect(url).toBe(
      `http://localhost:1337/admin/content-manager/collection-types/${TRANSACTION_WORKFLOW_COLLECTION_UID}/wf-doc-abc`,
    );
  });

  it('strips trailing slashes from admin base', () => {
    expect(
      transactionWorkflowAdminEditUrl(
        'https://kor.fejlesztesek.hu/admin/',
        'x',
      ),
    ).toBe(
      `https://kor.fejlesztesek.hu/admin/content-manager/collection-types/${TRANSACTION_WORKFLOW_COLLECTION_UID}/x`,
    );
  });

  it('returns null when documentId or base URL is missing', () => {
    expect(transactionWorkflowAdminEditUrl('', 'wf-1')).toBeNull();
    expect(
      transactionWorkflowAdminEditUrl('http://localhost:1337/admin', ''),
    ).toBeNull();
    expect(transactionWorkflowAdminEditUrl(null, 'wf-1')).toBeNull();
    expect(
      transactionWorkflowAdminEditUrl('http://localhost:1337/admin', null),
    ).toBeNull();
  });
});
