import { useEffect, useState } from 'react';

import { fetchEggInventoryReport } from './eggInventory.mock';
import type {
  DateRangePreset,
  EggInventoryReport,
  EggInventoryStatus,
} from './types';

export type EggInventoryQuery = {
  status: EggInventoryStatus;
  report: EggInventoryReport | null;
  errorMessage: string | null;
  reload: () => void;
};

export function useEggInventoryReport(
  preset: DateRangePreset,
): EggInventoryQuery {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<EggInventoryReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetchEggInventoryReport(preset)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(`${preset}:${reloadToken}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'egg inventory load failed',
        );
        setResolvedKey(`${preset}:${reloadToken}`);
      });

    return () => {
      active = false;
    };
  }, [preset, reloadToken]);

  const status: EggInventoryStatus =
    resolvedKey !== requestKey
      ? 'loading'
      : failed
        ? 'error'
        : report == null
          ? 'empty'
          : 'success';

  return {
    status,
    report: status === 'success' ? report : null,
    errorMessage: status === 'error' ? errorMessage : null,
    reload: () => setReloadToken((n) => n + 1),
  };
}
