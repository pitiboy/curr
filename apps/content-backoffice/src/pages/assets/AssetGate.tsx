import type { ReactNode } from 'react';

import { RoleGuard } from '../../auth/RoleGuard';
import { CONTENT_ROLES } from '../../auth/roles';
import { WorkflowFormGate } from '../../workflows/WorkflowFormGate';
import { ASSETS_FEATURE_ID } from './assetConstants';

/** `assets` feature flag + content role gate (redirects to /transactions otherwise). */
export function AssetGate({ children }: { children: ReactNode }) {
  return (
    <WorkflowFormGate roles={CONTENT_ROLES} workflowId={ASSETS_FEATURE_ID}>
      {children}
    </WorkflowFormGate>
  );
}

/** Category management: `assets` feature + controller only. */
export function AssetCategoryGate({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['controller']}>
      <AssetGate>{children}</AssetGate>
    </RoleGuard>
  );
}
