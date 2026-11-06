import { useEffect, useState } from 'react';

import { useBackofficeConfig } from '../../../workflows/useBackofficeConfig';
import { EGG_PRODUCTION_WORKFLOW_ID } from '../../../workflows/bulk-quantity/eggDailyEntry.constants';
import { eggSaleCurrencyForWorkflow } from '../../../workflows/parseBackofficeConfig';

import { fetchEggInventoryReport } from './eggInventory.fetch';
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
  const config = useBackofficeConfig();
  const saleCurrency = eggSaleCurrencyForWorkflow(
    config,
    EGG_PRODUCTION_WORKFLOW_ID,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${preset}:${saleCurrency}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [report, setReport] = useState<EggInventoryReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!config.ready) {
      return () => {
        active = false;
      };
    }

    fetchEggInventoryReport(preset, { saleCurrency })
      .then((data) => {
        if (!active) return;
        setReport(data);
        setFailed(false);
        setErrorMessage(null);
        setResolvedKey(`${preset}:${saleCurrency}:${reloadToken}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setFailed(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'egg inventory load failed',
        );
        setResolvedKey(`${preset}:${saleCurrency}:${reloadToken}`);
      });

    return () => {
      active = false;
    };
  }, [preset, reloadToken, saleCurrency, config.ready]);

  const status: EggInventoryStatus = !config.ready
    ? 'loading'
    : resolvedKey !== requestKey
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
