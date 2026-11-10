import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from 'react-admin';

import type { ContentRole } from './roles';
import { roleAllowed } from './roles';

type RoleGuardProps = {
  allow: ContentRole[];
  children: ReactNode;
};

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { permissions, isPending } = usePermissions();

  if (isPending) {
    return null;
  }

  if (typeof permissions !== 'string' || !roleAllowed(allow, permissions)) {
    return <Navigate replace to="/transactions" />;
  }

  return children;
}
