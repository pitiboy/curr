import { useEffect, useMemo } from 'react';
import { useDataProvider, useNotify, useRefresh } from 'react-admin';
import { strapiHttpClient } from 'ra-strapi';

import { STRAPI_AUTH_CHANGED_EVENT } from '../../auth/strapiAuthStorage';
import { dataProviderInner } from '../dataProvider';

import { createPendingChangesRetryRunner } from './retryRunner';
import { setPendingChangesNotify } from './notify';

export function PendingChangesRunner() {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  useEffect(() => {
    setPendingChangesNotify((message, options) => notify(message, options));
    return () => setPendingChangesNotify(null);
  }, [notify]);

  const runner = useMemo(
    () =>
      createPendingChangesRetryRunner(
        dataProvider,
        () => {
          refresh();
        },
        {
          innerProvider: dataProviderInner,
          httpClient: strapiHttpClient(),
        },
      ),
    [dataProvider, refresh],
  );

  useEffect(() => {
    runner.start();
    return () => runner.stop();
  }, [runner]);

  useEffect(() => {
    const onOnline = () => {
      void runner.runOnce();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runner]);

  useEffect(() => {
    const onAuthChanged = () => {
      void runner.runOnce();
    };
    window.addEventListener(STRAPI_AUTH_CHANGED_EVENT, onAuthChanged);
    return () =>
      window.removeEventListener(STRAPI_AUTH_CHANGED_EVENT, onAuthChanged);
  }, [runner]);

  return null;
}
