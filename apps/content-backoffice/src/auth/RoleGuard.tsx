import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from 'react-admin';

import type { ContentRole } from './roles';
import { isContentRole } from './roles';

type RoleGuardProps = {
  allow: ContentRole[];
  children: ReactNode;
};

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { permissions, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!isContentRole(permissions) || !allow.includes(permissions)) {
    return <Navigate to="/transactions" replace />;
  }

  return children;
}
