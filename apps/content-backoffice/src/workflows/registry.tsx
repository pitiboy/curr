import type { ReactNode } from 'react';

import type { ContentRole } from '../auth/roles';
import { BulkQuantityEntryPage } from './bulk-quantity/BulkQuantityEntryPage';
import { eggDailyEntryConfig } from './bulk-quantity/configs/eggDailyEntry.config';

export type WorkflowForm = {
  id: string;
  roles: readonly ContentRole[];
  path: string;
  labelKey: string;
  element: ReactNode;
};

/** Deal forms under the transactions menu. */
export const workflowForms: readonly WorkflowForm[] = [
  {
    id: eggDailyEntryConfig.workflowId,
    roles: eggDailyEntryConfig.roles,
    path: eggDailyEntryConfig.path,
    labelKey: eggDailyEntryConfig.labelKey,
    element: <BulkQuantityEntryPage config={eggDailyEntryConfig} />,
  },
];
