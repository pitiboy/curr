import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';

import { PENDING_CHANGES_FEATURE_ID } from './types';

export function PendingChangesFeatureGate({
  children,
}: {
  children: ReactNode;
}) {
  const { enabled, ready } = useBackofficeConfig();

  if (!ready) {
    return null;
  }

  if (!enabled.includes(PENDING_CHANGES_FEATURE_ID)) {
    return <Navigate replace to="/transactions" />;
  }

  return children;
}
