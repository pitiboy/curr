import type { ReactNode } from 'react';

import type { ContentRole } from '../auth/roles';

export type WorkflowForm = {
  id: string;
  roles: readonly ContentRole[];
  path: string;
  labelKey: string;
  element: ReactNode;
};

/** Deal forms under the transactions menu. Empty until one is registered. */
export const workflowForms: readonly WorkflowForm[] = [];
