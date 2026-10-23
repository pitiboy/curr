import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { strapiHttpClient } from 'ra-strapi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DateInput,
  SaveButton,
  SimpleForm,
  Title,
  Toolbar,
  useDataProvider,
  useTranslate,
} from 'react-admin';

import { STRAPI_URL } from '../../config';
import { bandedForm } from '../../theme';
import { findDuplicateForRow } from './duplicateFetch';
import { loadBulkQuantityCatalog } from './loadCatalog';
import {
  buildRowPlans,
  buildTransactionPayload,
  failedRowIds,
  invalidQuantityInput,
  mergeRowResults,
  plansForRetry,
  rowsFromQuantities,
  todayIsoDate,
} from './logic';
import { executeRowPlans } from './saveRows';
import type {
  BulkQuantityConflictChoice,
  BulkQuantityDuplicate,
  BulkQuantityHenHouse,
  BulkQuantityResolvedRefs,
  BulkQuantityRowPlan,
  BulkQuantityRowResult,
  BulkQuantityWorkflowConfig,
} from './types';

const httpClient = strapiHttpClient({ storage: localStorage });

function SaveToolbar({ disabled }: { disabled: boolean }) {
  return (
    <Toolbar>
      <SaveButton disabled={disabled} label="app.bulk_quantity.save" />
    </Toolbar>
  );
}

export function BulkQuantityEntryPage({
  config,
}: {
  config: BulkQuantityWorkflowConfig;
}) {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const [henHouses, setHenHouses] = useState<BulkQuantityHenHouse[]>([]);
  const [refs, setRefs] = useState<BulkQuantityResolvedRefs | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogPending, setCatalogPending] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [results, setResults] = useState<BulkQuantityRowResult[]>([]);
  const [conflicts, setConflicts] = useState<BulkQuantityDuplicate[]>([]);
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, BulkQuantityConflictChoice>
  >({});
  const [pendingPlans, setPendingPlans] = useState<BulkQuantityRowPlan[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitDate, setSubmitDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCatalogPending(true);
    setCatalogError(null);

    loadBulkQuantityCatalog(httpClient, STRAPI_URL, config)
      .then(({ henHouses: houses, refs: loadedRefs }) => {
        if (!active) {
          return;
        }
        setHenHouses(houses);
        if (!loadedRefs) {
          setCatalogError(translate('app.bulk_quantity.catalog_missing'));
          setRefs(null);
          return;
        }
        setRefs(loadedRefs);
      })
      .catch(() => {
        if (active) {
          setCatalogError(translate('app.bulk_quantity.catalog_missing'));
        }
      })
      .finally(() => {
        if (active) {
          setCatalogPending(false);
        }
      });

    return () => {
      active = false;
    };
  }, [config, translate]);

  const failedIds = useMemo(() => failedRowIds(results), [results]);

  const buildPayload = useCallback(
    (plan: BulkQuantityRowPlan, date: string) => {
      if (!refs) {
        return {};
      }
      const description = translate(config.descriptionKey, {
        organization: plan.organizationName,
        amount: plan.amount,
      });
      return buildTransactionPayload(refs, plan, date, description);
    },
    [config, refs, translate],
  );

  const runPlans = useCallback(
    async (plans: BulkQuantityRowPlan[], date: string) => {
      setSaving(true);
      const batch = await executeRowPlans(dataProvider, plans, (plan) =>
        buildPayload(plan, date),
      );
      setResults((previous) => mergeRowResults(previous, batch));
      setSaving(false);
    },
    [buildPayload, dataProvider],
  );

  const resolveDate = (value: unknown): string | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return todayIsoDate(value);
    }
    if (typeof value === 'string' && value.trim()) {
      const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
      return match ? match[1]! : null;
    }
    return null;
  };

  const submit = async (values: Record<string, unknown>) => {
    if (!refs) {
      return {};
    }
    const date = resolveDate(values.date);
    if (!date) {
      return { date: translate('ra.validation.required') };
    }
    for (const house of henHouses) {
      if (invalidQuantityInput(quantities[house.documentId])) {
        return {
          [`quantity_${house.documentId}`]: translate(
            'app.bulk_quantity.invalid_quantity',
          ),
        };
      }
    }
    const rows = rowsFromQuantities(henHouses, quantities);
    if (rows.length === 0) {
      return { _form: translate('app.bulk_quantity.no_rows') };
    }

    const duplicates: BulkQuantityDuplicate[] = [];
    for (const row of rows) {
      const duplicate = await findDuplicateForRow(httpClient, STRAPI_URL, {
        date,
        row,
        currencyTypeId: refs.currencyTypeId,
        debitAccountId: refs.debitAccountId,
        creditAccountId: refs.creditAccountId,
      });
      if (duplicate) {
        duplicates.push(duplicate);
      }
    }

    const defaultChoices = Object.fromEntries(
      duplicates.map((item) => [item.row.organizationId, 'update' as const]),
    );
    setConflictChoices(defaultChoices);
    const plans = buildRowPlans(rows, duplicates, defaultChoices);
    setSubmitDate(date);
    setPendingPlans(plans);

    if (duplicates.length > 0) {
      setConflicts(duplicates);
      setConflictOpen(true);
      return {};
    }

    await runPlans(plans, date);
    return {};
  };

  const confirmConflicts = async () => {
    if (!submitDate) {
      return;
    }
    const rows = pendingPlans.map(({ organizationId, organizationName, amount }) => ({
      organizationId,
      organizationName,
      amount,
    }));
    const plans = buildRowPlans(rows, conflicts, conflictChoices);
    setPendingPlans(plans);
    setConflictOpen(false);
    await runPlans(plans, submitDate);
  };

  const retryFailed = async () => {
    if (!submitDate) {
      return;
    }
    const plans = plansForRetry(pendingPlans, failedIds);
    if (plans.length === 0) {
      return;
    }
    await runPlans(plans, submitDate);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 640 }}>
      <Title title={config.labelKey} />
      {catalogError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {catalogError}
        </Alert>
      ) : null}
      <SimpleForm
        defaultValues={{ date: todayIsoDate() }}
        sx={bandedForm}
        toolbar={<SaveToolbar disabled={catalogPending || !refs || saving} />}
        onSubmit={submit}
      >
        <DateInput fullWidth source="date" />

        {catalogPending ? (
          <Typography color="text.secondary" variant="body2">
            {translate('ra.message.loading')}
          </Typography>
        ) : null}

        {!catalogPending && henHouses.length === 0 ? (
          <Typography color="warning.main" variant="body2">
            {translate('app.bulk_quantity.no_hen_houses')}
          </Typography>
        ) : null}

        <Stack spacing={2} sx={{ width: '100%' }}>
          {henHouses.map((house) => (
            <TextField
              key={house.documentId}
              fullWidth
              inputMode="numeric"
              label={house.name}
              slotProps={{
                htmlInput: {
                  min: 0,
                  step: 1,
                  style: { fontSize: '1.25rem', padding: '14px 12px' },
                },
              }}
              type="number"
              value={quantities[house.documentId] ?? ''}
              onChange={(event) =>
                setQuantities((previous) => ({
                  ...previous,
                  [house.documentId]: event.target.value,
                }))
              }
            />
          ))}
        </Stack>
      </SimpleForm>

      {results.length > 0 ? (
        <Stack spacing={1} sx={{ mt: 3 }}>
          <Typography variant="subtitle1">
            {translate('app.bulk_quantity.results_heading')}
          </Typography>
          {results.map((row) => (
            <Alert
              key={row.organizationId}
              severity={row.status === 'success' ? 'success' : 'error'}
            >
              {row.organizationName}
              {row.status === 'error' && row.message
                ? `: ${row.message}`
                : ''}
            </Alert>
          ))}
          {failedIds.length > 0 ? (
            <Button
              disabled={saving}
              variant="outlined"
              onClick={() => retryFailed()}
            >
              {translate('app.bulk_quantity.retry_failed')}
            </Button>
          ) : null}
        </Stack>
      ) : null}

      <ConflictDialog
        choices={conflictChoices}
        conflicts={conflicts}
        open={conflictOpen}
        onCancel={() => setConflictOpen(false)}
        onChange={(organizationId, choice) =>
          setConflictChoices((previous) => ({
            ...previous,
            [organizationId]: choice,
          }))
        }
        onConfirm={() => confirmConflicts()}
      />
    </Box>
  );
}

function ConflictDialog({
  open,
  conflicts,
  choices,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  conflicts: BulkQuantityDuplicate[];
  choices: Record<string, BulkQuantityConflictChoice>;
  onChange: (organizationId: string, choice: BulkQuantityConflictChoice) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const translate = useTranslate();
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onCancel}>
      <DialogTitle>{translate('app.bulk_quantity.conflict_title')}</DialogTitle>
      <DialogContent>
        <Typography gutterBottom variant="body2">
          {translate('app.bulk_quantity.conflict_body')}
        </Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {conflicts.map((conflict) => (
            <Box key={conflict.row.organizationId}>
              <Typography sx={{ fontWeight: 600 }} variant="subtitle2">
                {conflict.row.organizationName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {translate('app.bulk_quantity.conflict_existing', {
                  amount: conflict.existingAmount,
                })}
              </Typography>
              <FormControl>
                <RadioGroup
                  value={choices[conflict.row.organizationId] ?? 'update'}
                  onChange={(_event, value) =>
                    onChange(
                      conflict.row.organizationId,
                      value as BulkQuantityConflictChoice,
                    )
                  }
                >
                  <FormControlLabel
                    control={<Radio />}
                    label={translate('app.bulk_quantity.conflict_update')}
                    value="update"
                  />
                  <FormControlLabel
                    control={<Radio />}
                    label={translate('app.bulk_quantity.conflict_insert')}
                    value="insert"
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{translate('ra.action.cancel')}</Button>
        <Button variant="contained" onClick={onConfirm}>
          {translate('app.bulk_quantity.conflict_continue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
