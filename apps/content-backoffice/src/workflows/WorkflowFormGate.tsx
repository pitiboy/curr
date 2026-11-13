import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from 'react-admin';

import type { ContentRole } from '../auth/roles';
import { roleAllowed } from '../auth/roles';
import { featureRolesFromConfig } from './featureRoles';
import { useBackofficeConfig } from './useBackofficeConfig';

type WorkflowFormGateProps = {
  workflowId: string;
  /** Fallback when the feature row has no `config.roles`. */
  roles: readonly ContentRole[];
  children: ReactNode;
};

export function WorkflowFormGate({
  workflowId,
  roles,
  children,
}: WorkflowFormGateProps) {
  const { enabled, features, ready } = useBackofficeConfig();
  const { permissions, isPending } = usePermissions();
  const fromConfig = featureRolesFromConfig(features[workflowId]?.config);
  const effectiveRoles = fromConfig.length > 0 ? fromConfig : roles;

  if (!ready || isPending) {
    return null;
  }

  if (
    !enabled.includes(workflowId) ||
    typeof permissions !== 'string' ||
    !roleAllowed(effectiveRoles, permissions)
  ) {
    return <Navigate to="/transactions" replace />;
  }

  return children;
}
