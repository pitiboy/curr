import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { strapiHttpClient } from 'ra-strapi';

import { STRAPI_URL } from '../config';
import {
  BackofficeConfigContext,
  type BackofficeConfigValue,
} from './backofficeConfigContext';
import {
  effectiveWorkflows,
  parseWorkflowOverride,
} from './effectiveWorkflows';
import {
  parseBackofficeConfig,
  type BackofficeConfigResponse,
} from './parseBackofficeConfig';
import { WORKFLOW_OVERRIDE_KEY } from './storage';

const httpClient = strapiHttpClient({ storage: localStorage });

function readOverride(): string[] | null {
  return parseWorkflowOverride(localStorage.getItem(WORKFLOW_OVERRIDE_KEY));
}

export function BackofficeConfigProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<BackofficeConfigResponse>({
    enabled: [],
    available: [],
  });
  const [override, setOverrideState] = useState<string[] | null>(readOverride);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    httpClient(`${STRAPI_URL}/api/backoffice/config`)
      .then(({ json }) => {
        if (active) {
          setServer(parseBackofficeConfig(json));
        }
      })
      .catch(() => {
        if (active) {
          setServer({ enabled: [], available: [] });
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const setOverride = useCallback(
    (ids: string[]) => {
      const known = new Set(server.available);
      const next = ids.filter(
        (id, index) => known.has(id) && ids.indexOf(id) === index,
      );
      localStorage.setItem(WORKFLOW_OVERRIDE_KEY, JSON.stringify(next));
      setOverrideState(next);
    },
    [server.available],
  );

  const clearOverride = useCallback(() => {
    localStorage.removeItem(WORKFLOW_OVERRIDE_KEY);
    setOverrideState(null);
  }, []);

  const value = useMemo<BackofficeConfigValue>(
    () => ({
      enabled: server.enabled,
      available: server.available,
      effective: ready
        ? effectiveWorkflows(server.enabled, server.available, override)
        : [],
      hasOverride: override !== null,
      ready,
      setOverride,
      clearOverride,
    }),
    [server, override, ready, setOverride, clearOverride],
  );

  return (
    <BackofficeConfigContext.Provider value={value}>
      {children}
    </BackofficeConfigContext.Provider>
  );
}
