import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from 'react-admin';

import type { ContentRole } from '../auth/roles';
import { roleAllowed } from '../auth/roles';
import { useBackofficeConfig } from './useBackofficeConfig';

type WorkflowFormGateProps = {
  workflowId: string;
  roles: readonly ContentRole[];
  children: ReactNode;
};

export function WorkflowFormGate({
  workflowId,
  roles,
  children,
}: WorkflowFormGateProps) {
  const { enabled, ready } = useBackofficeConfig();
  const { permissions, isPending } = usePermissions();

  if (!ready || isPending) {
    return null;
  }

  if (
    !enabled.includes(workflowId) ||
    typeof permissions !== 'string' ||
    !roleAllowed(roles, permissions)
  ) {
    return <Navigate to="/transactions" replace />;
  }

  return children;
}
