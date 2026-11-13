import { useEffect } from 'react';

import { invalidateTransactionWorkflowCatalog } from '../workflows/useTransactionWorkflowCatalog';
import {
  parseVersionJsonPayload,
  shouldReloadForBuildId,
} from './deployRefresh';

const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

async function checkDeployAndWorkflows(currentBuildId: string): Promise<void> {
  invalidateTransactionWorkflowCatalog();

  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const payload: unknown = await response.json();
    const { buildId } = parseVersionJsonPayload(payload);
    if (shouldReloadForBuildId(currentBuildId, buildId)) {
      window.location.reload();
    }
  } catch {
    // Network or parse errors must not reload-loop.
  }
}

export function DeployRefreshChecker() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }

    const currentBuildId = import.meta.env.VITE_BUILD_ID ?? '';

    const onResume = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void checkDeployAndWorkflows(currentBuildId);
    };

    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, []);

  return null;
}
