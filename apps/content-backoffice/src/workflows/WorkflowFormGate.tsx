import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from 'react-admin';

import type { ContentRole } from '../auth/roles';
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
  const { effective, ready } = useBackofficeConfig();
  const { permissions, isLoading } = usePermissions();

  if (!ready || isLoading) {
    return null;
  }

  if (
    !effective.includes(workflowId) ||
    !roles.some((role) => role === permissions)
  ) {
    return <Navigate to="/transactions" replace />;
  }

  return children;
}
