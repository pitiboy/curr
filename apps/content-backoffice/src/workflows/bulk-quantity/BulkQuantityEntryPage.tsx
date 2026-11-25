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
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { strapiHttpClient } from 'ra-strapi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  DateInput,
  SaveButton,
  SimpleForm,
  Title,
  Toolbar,
  useNotify,
  useTranslate,
} from 'react-admin';

import { STRAPI_URL } from '../../config';
import {
  isOverDistributed,
  memberNeedsSaleRate,
  pickLatestCurrencyRate,
  remainingEggs,
  totalDistributed,
  totalProduced,
} from '../../../../../src/egg-production/distribution.ts';
import {
  eggProductionInitialPublicationStatus,
  eggSaleCurrencyForWorkflow,
} from '../parseBackofficeConfig';
import { useBackofficeConfig } from '../useBackofficeConfig';
import { bandedForm, bandedSpanClass } from '../../theme';
import { useSubmitGuard } from '../../submit/useSubmitGuard';
import {
  EGG_CONFLICT_CHOICE_REQUIRED,
  conflictGroups,
  parseEggEntriesError,
  postEggEntries,
  summarizeEggEntries,
  type EggConflict,
  type EggEntriesRequest,
  type EggPlanWarning,
  type EggRowSummary,
} from './eggEntriesApi';
import { loadHenHouses } from './loadCatalog';
import { loadCurrencyRates, loadDistributionMembers } from './loadDistribution';
import {
  distributionRequestRows,
  invalidQuantityInput,
  rowsFromQuantities,
  todayIsoDate,
} from './logic';
import type {
  BulkQuantityHenHouse,
  BulkQuantityWorkflowConfig,
  DistributionMember,
  EggConflictChoice,
} from './types';
import { VoiceBulkQuantityEntry } from './VoiceBulkQuantityEntry';
import type { VoiceEggBulkFormPlan } from './voiceBulkQuantity';

const httpClient = strapiHttpClient({ storage: localStorage });

function BulkQuantityFormDirtySync({ rowCount }: { rowCount: number }) {
  const { setValue } = useFormContext();
  useEffect(() => {
    setValue('_bulkRowCount', rowCount, { shouldDirty: rowCount > 0 });
  }, [rowCount, setValue]);
  return null;
}

function FormDateWatcher({ onDate }: { onDate: (isoDate: string) => void }) {
  const { watch } = useFormContext();
  const rawDate = watch('date');
  useEffect(() => {
    if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
      onDate(todayIsoDate(rawDate));
      return;
    }
    if (typeof rawDate === 'string' && rawDate.trim()) {
      const match = /^(\d{4}-\d{2}-\d{2})/.exec(rawDate.trim());
      if (match) {
        onDate(match[1]!);
      }
    }
  }, [onDate, rawDate]);
  return null;
}

type WizardToolbarProps = {
  activeStep: number;
  hasDistribution: boolean;
  singleLayout: boolean;
  disabled: boolean;
  saving: boolean;
  onProductionOnly: () => void;
  onNext: () => void;
  onBack: () => void;
  onSaveAll: () => void;
  onSingleSave: () => void;
};

function WizardToolbar({
  activeStep,
  hasDistribution,
  singleLayout,
  disabled,
  saving,
  onProductionOnly,
  onNext,
  onBack,
  onSaveAll,
  onSingleSave,
}: WizardToolbarProps) {
  const translate = useTranslate();
  return (
    <Toolbar>
      {singleLayout ? (
        <Button
          disabled={disabled || saving}
          type="button"
          variant="contained"
          onClick={onSingleSave}
        >
          {translate('app.bulk_quantity.save')}
        </Button>
      ) : null}
      {!singleLayout && activeStep === 0 && hasDistribution ? (
        <>
          <Button
            disabled={disabled || saving}
            type="button"
            variant="outlined"
            onClick={onProductionOnly}
          >
            {translate('app.bulk_quantity.save_production_only')}
          </Button>
          <Button
            disabled={disabled || saving}
            sx={{ ml: 1 }}
            type="button"
            variant="contained"
            onClick={onNext}
          >
            {translate('app.bulk_quantity.next_distribution')}
          </Button>
        </>
      ) : null}
      {!singleLayout && activeStep === 0 && !hasDistribution ? (
        <Button disabled={disabled || saving} type="submit" variant="contained">
          {translate('app.bulk_quantity.save')}
        </Button>
      ) : null}
      {!singleLayout && activeStep === 1 ? (
        <>
          <Button disabled={saving} type="button" onClick={onBack}>
            {translate('app.bulk_quantity.back_production')}
          </Button>
          <Button
            disabled={disabled || saving}
            sx={{ ml: 1 }}
            type="button"
            variant="contained"
            onClick={onSaveAll}
          >
            {translate('app.bulk_quantity.save_production_and_distribution')}
          </Button>
        </>
      ) : null}
    </Toolbar>
  );
}

type SaveError = { message: string; label: string | null };

export function BulkQuantityEntryPage({
  config,
}: {
  config: BulkQuantityWorkflowConfig;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const backofficeConfig = useBackofficeConfig();
  const eggSaleCurrency = eggSaleCurrencyForWorkflow(
    backofficeConfig,
    config.workflowId,
  );
  const autoPublish =
    eggProductionInitialPublicationStatus(backofficeConfig) === 'published';
  const hasDistribution = Boolean(config.distribution);
  const singleLayout = config.layout === 'single' && hasDistribution;

  const [activeStep, setActiveStep] = useState(0);
  const [henHouses, setHenHouses] = useState<BulkQuantityHenHouse[]>([]);
  const [distributionMembers, setDistributionMembers] = useState<
    DistributionMember[]
  >([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogPending, setCatalogPending] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [memberQuantities, setMemberQuantities] = useState<
    Record<string, string>
  >({});
  const [resultRows, setResultRows] = useState<EggRowSummary[]>([]);
  const [warnings, setWarnings] = useState<EggPlanWarning[]>([]);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [conflicts, setConflicts] = useState<EggConflict[]>([]);
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, EggConflictChoice>
  >({});
  const [globalConflictChoice, setGlobalConflictChoice] =
    useState<EggConflictChoice>('replace');
  const [conflictOpen, setConflictOpen] = useState(false);
  const [globalConflictOpen, setGlobalConflictOpen] = useState(false);
  /** Last request body (no conflict choice): conflict dialog / retry resend it. */
  const [pendingRequest, setPendingRequest] =
    useState<EggEntriesRequest | null>(null);
  // One request at a time; the XState guard drops a second tap synchronously.
  const saveGuard = useSubmitGuard<() => Promise<void>>({
    run: (task) => task(),
    onError: () => notify('ra.notification.http_error', { type: 'error' }),
  });
  const saving = saveGuard.submitting;
  const runGuarded = (task: () => Promise<void>) => {
    saveGuard.submit(task);
  };
  const [formDate, setFormDate] = useState(todayIsoDate());
  const [eggToSaleRate, setEggToSaleRate] = useState<number | null>(null);
  const [rateValidFrom, setRateValidFrom] = useState<string | null>(null);
  const [distributionLoadError, setDistributionLoadError] = useState<
    string | null
  >(null);
  /** Remounts SimpleForm so react-hook-form state resets after a successful save. */
  const [bulkFormKey, setBulkFormKey] = useState(0);

  const resetInputs = useCallback(() => {
    setQuantities({});
    setMemberQuantities({});
    setConflicts([]);
    setConflictChoices({});
    setPendingRequest(null);
    setConflictOpen(false);
    setGlobalConflictOpen(false);
    setActiveStep(0);
    setFormDate(todayIsoDate());
    setBulkFormKey((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setCatalogPending(true);
    setCatalogError(null);
    loadHenHouses(httpClient, STRAPI_URL, config.parentOrganizationName)
      .then((houses) => {
        if (active) setHenHouses(houses);
      })
      .catch(() => {
        if (active) {
          setCatalogError(translate('app.bulk_quantity.catalog_missing'));
        }
      })
      .finally(() => {
        if (active) setCatalogPending(false);
      });
    return () => {
      active = false;
    };
  }, [config.parentOrganizationName, translate]);

  const refreshDistributionContext = useCallback(
    async (isoDate: string) => {
      if (!config.distribution) {
        return;
      }
      setDistributionLoadError(null);
      try {
        const [members, rates] = await Promise.all([
          loadDistributionMembers(
            httpClient,
            STRAPI_URL,
            config.distribution,
            isoDate,
          ),
          loadCurrencyRates(httpClient, STRAPI_URL),
        ]);
        setDistributionMembers(members);
        const rate = pickLatestCurrencyRate(
          rates,
          config.currencyCode,
          eggSaleCurrency,
          isoDate,
        );
        if (memberNeedsSaleRate(members) && !rate) {
          setEggToSaleRate(null);
          setRateValidFrom(null);
          setDistributionLoadError(
            translate('app.bulk_quantity.distribution_rate_missing', {
              from: config.currencyCode,
              to: eggSaleCurrency,
            }),
          );
          return;
        }
        setEggToSaleRate(rate?.rate ?? 1);
        setRateValidFrom(rate?.validFrom ?? null);
      } catch {
        setDistributionLoadError(
          translate('app.bulk_quantity.distribution_members_failed'),
        );
      }
    },
    [config.currencyCode, config.distribution, eggSaleCurrency, translate],
  );

  useEffect(() => {
    if (!hasDistribution || catalogPending) {
      return;
    }
    void refreshDistributionContext(formDate);
  }, [catalogPending, formDate, hasDistribution, refreshDistributionContext]);

  const productionRows = useMemo(
    () => rowsFromQuantities(henHouses, quantities),
    [henHouses, quantities],
  );

  const producedTotal = useMemo(
    () => totalProduced(productionRows),
    [productionRows],
  );

  const distributedTotal = useMemo(
    () =>
      totalDistributed(
        memberQuantities,
        distributionMembers.map((member) => member.memberId),
      ),
    [distributionMembers, memberQuantities],
  );

  const remaining = remainingEggs(producedTotal, distributedTotal);
  const overLimit = isOverDistributed(producedTotal, distributedTotal);

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

  const validateProductionInputs = (): Record<string, string> | null => {
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
    return null;
  };

  const buildRequest = (
    date: string,
    includeDistribution: boolean,
  ): EggEntriesRequest => ({
    date,
    productions: rowsFromQuantities(henHouses, quantities).map((row) => ({
      organizationId: row.organizationId,
      quantity: row.amount,
    })),
    distributions: includeDistribution
      ? distributionRequestRows(
          distributionMembers.map((member) => member.memberId),
          memberQuantities,
        )
      : [],
    publish: autoPublish,
  });

  /** Single POST; 409 → conflict dialog, anything else → error alert. */
  const send = async (
    request: EggEntriesRequest,
    choice?: Pick<EggEntriesRequest, 'conflictChoice' | 'conflictChoices'>,
  ) => {
    setSaveError(null);
    setPendingRequest(request);
    try {
      const response = await postEggEntries(
        httpClient,
        STRAPI_URL,
        config.entriesPath,
        { ...request, ...choice },
      );
      resetInputs();
      setResultRows(summarizeEggEntries(response));
      setWarnings(response.warnings);
      notify('app.bulk_quantity.save_success', { type: 'success' });
    } catch (error) {
      const parsed = parseEggEntriesError(error);
      if (
        parsed.status === 409 &&
        parsed.code === EGG_CONFLICT_CHOICE_REQUIRED
      ) {
        setConflicts(parsed.conflicts);
        if (hasDistribution) {
          setGlobalConflictOpen(true);
        } else {
          setConflictChoices(
            Object.fromEntries(
              conflictGroups(parsed.conflicts).map((row) => [
                row.groupKey,
                'replace' as const,
              ]),
            ),
          );
          setConflictOpen(true);
        }
        return;
      }
      setResultRows([]);
      setWarnings([]);
      setSaveError({
        message: parsed.message || translate('ra.notification.http_error'),
        label: parsed.label,
      });
    }
  };

  const submitWith = (date: string, includeDistribution: boolean) => {
    const request = buildRequest(date, includeDistribution);
    runGuarded(() => send(request));
  };

  const submit = async (values: Record<string, unknown>) => {
    const date = resolveDate(values.date);
    if (!date) {
      return { date: translate('ra.validation.required') };
    }
    setFormDate(date);
    const validationError = validateProductionInputs();
    if (validationError) {
      return validationError;
    }
    submitWith(date, false);
    return {};
  };

  const handleProductionOnly = () => {
    if (validateProductionInputs()) {
      return;
    }
    submitWith(formDate, false);
  };

  /** Single-page save: empty distribution → production only. */
  const handleSingleSave = () => {
    if (validateProductionInputs()) {
      return;
    }
    const includeDistribution = distributedTotal > 0;
    if (includeDistribution) {
      if (memberNeedsSaleRate(distributionMembers) && eggToSaleRate === null) {
        return;
      }
      for (const member of distributionMembers) {
        if (invalidQuantityInput(memberQuantities[member.memberId])) {
          return;
        }
      }
    }
    submitWith(formDate, includeDistribution);
  };

  const applyVoicePlan = useCallback((plan: VoiceEggBulkFormPlan) => {
    if (plan.date) {
      setFormDate(plan.date);
    }
    if (Object.keys(plan.quantities).length > 0) {
      setQuantities((previous) => ({ ...previous, ...plan.quantities }));
    }
    if (Object.keys(plan.memberQuantities).length > 0) {
      setMemberQuantities((previous) => ({
        ...previous,
        ...plan.memberQuantities,
      }));
    }
  }, []);

  const handleNext = async () => {
    if (validateProductionInputs()) {
      return;
    }
    await refreshDistributionContext(formDate);
    setActiveStep(1);
  };

  const handleSaveAll = () => {
    if (memberNeedsSaleRate(distributionMembers) && eggToSaleRate === null) {
      return;
    }
    for (const member of distributionMembers) {
      if (invalidQuantityInput(memberQuantities[member.memberId])) {
        return;
      }
    }
    submitWith(formDate, true);
  };

  const confirmGlobalConflicts = () => {
    if (!pendingRequest) {
      return;
    }
    setGlobalConflictOpen(false);
    const request = pendingRequest;
    runGuarded(() => send(request, { conflictChoice: globalConflictChoice }));
  };

  const confirmConflicts = () => {
    if (!pendingRequest) {
      return;
    }
    setConflictOpen(false);
    const request = pendingRequest;
    runGuarded(() =>
      send(request, {
        conflictChoice: globalConflictChoice,
        conflictChoices,
      }),
    );
  };

  const retry = () => {
    if (!pendingRequest) {
      return;
    }
    const request = pendingRequest;
    runGuarded(() => send(request));
  };

  const distributionNeeded =
    (singleLayout && distributedTotal > 0) ||
    (!singleLayout && activeStep === 1);
  const stepDisabled =
    catalogPending ||
    saving ||
    productionRows.length === 0 ||
    (distributionNeeded &&
      memberNeedsSaleRate(distributionMembers) &&
      eggToSaleRate === null);

  const resultMessage = (row: EggRowSummary) => {
    const parts: string[] = [];
    if (row.created > 0) {
      parts.push(
        translate('app.bulk_quantity.result_created', { count: row.created }),
      );
    }
    if (row.updated > 0) {
      parts.push(
        translate('app.bulk_quantity.result_updated', { count: row.updated }),
      );
    }
    if (row.skipped > 0) {
      parts.push(
        translate('app.bulk_quantity.result_skipped', { count: row.skipped }),
      );
    }
    if (row.published) {
      parts.push(translate('app.bulk_quantity.result_published'));
    }
    return parts.join(', ');
  };

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 2 },
        maxWidth: hasDistribution
          ? { xs: '100%', md: singleLayout ? 1100 : 960 }
          : 640,
      }}
    >
      <Title title={config.labelKey} />
      {catalogError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {catalogError}
        </Alert>
      ) : null}
      {hasDistribution && !singleLayout ? (
        <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
          <Step completed={activeStep > 0}>
            <StepLabel>
              {translate('app.bulk_quantity.step_production')}
            </StepLabel>
          </Step>
          <Step>
            <StepLabel>
              {translate('app.bulk_quantity.step_distribution')}
            </StepLabel>
          </Step>
        </Stepper>
      ) : null}

      <SimpleForm
        key={bulkFormKey}
        defaultValues={{ date: todayIsoDate(), _bulkRowCount: 0 }}
        sx={
          [
            bandedForm,
            singleLayout
              ? (theme: Theme) => ({
                  // Keep the RA form stack one column; we own the two-pane layout.
                  '&& > .MuiStack-root': {
                    gridTemplateColumns: 'minmax(0, 1fr)',
                    [theme.breakpoints.up('md')]: {
                      gridTemplateColumns: 'minmax(0, 1fr)',
                    },
                  },
                })
              : null,
          ] as SxProps<Theme>
        }
        toolbar={
          hasDistribution ? (
            <WizardToolbar
              activeStep={activeStep}
              disabled={stepDisabled}
              hasDistribution={hasDistribution}
              saving={saving}
              singleLayout={singleLayout}
              onBack={() => setActiveStep(0)}
              onNext={() => void handleNext()}
              onProductionOnly={handleProductionOnly}
              onSaveAll={handleSaveAll}
              onSingleSave={handleSingleSave}
            />
          ) : (
            <Toolbar>
              <SaveButton
                disabled={
                  catalogPending || saving || productionRows.length === 0
                }
                label="app.bulk_quantity.save"
              />
            </Toolbar>
          )
        }
        onSubmit={submit}
      >
        <BulkQuantityFormDirtySync rowCount={productionRows.length} />
        <FormDateWatcher onDate={setFormDate} />

        {config.voice?.enabled ? (
          <VoiceBulkQuantityEntry
            disabled={catalogPending || saving}
            organizationId={null}
            voice={config.voice}
            workflowId={config.workflowId}
            onApplied={applyVoicePlan}
          />
        ) : null}

        {singleLayout && hasDistribution ? (
          <Box
            className={bandedSpanClass}
            sx={(theme) => ({
              display: 'grid',
              gap: theme.spacing(2),
              width: '100%',
              alignItems: 'start',
              gridTemplateColumns: 'minmax(0, 1fr)',
              [theme.breakpoints.up('md')]: {
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              },
            })}
          >
            <Stack spacing={2} sx={{ minWidth: 0, width: '100%' }}>
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
              <Typography variant="subtitle1">
                {translate('app.bulk_quantity.step_production')}
              </Typography>
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
              <Box sx={{ display: { xs: 'none', md: 'block' }, pt: 1 }}>
                <DistributionSummaryBlock
                  currencyCode={config.currencyCode}
                  distributedTotal={distributedTotal}
                  distributionLoadError={distributionLoadError}
                  eggSaleCurrency={eggSaleCurrency}
                  eggToSaleRate={eggToSaleRate}
                  overLimit={overLimit}
                  producedTotal={producedTotal}
                  rateValidFrom={rateValidFrom}
                  remaining={remaining}
                />
              </Box>
            </Stack>

            <Stack spacing={2} sx={{ minWidth: 0, width: '100%' }}>
              <Typography variant="subtitle1">
                {translate('app.bulk_quantity.step_distribution')}
              </Typography>
              {distributionMembers.length === 0 ? (
                <Typography color="warning.main" variant="body2">
                  {translate('app.bulk_quantity.distribution_no_members', {
                    org: config.distribution?.memberOrganizationName ?? '',
                  })}
                </Typography>
              ) : null}
              {distributionMembers.map((member) => (
                <TextField
                  key={member.memberId}
                  disabled={
                    memberNeedsSaleRate([member]) && eggToSaleRate === null
                  }
                  fullWidth
                  inputMode="numeric"
                  label={member.memberName}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      step: 1,
                      style: { fontSize: '1.25rem', padding: '14px 12px' },
                    },
                  }}
                  type="number"
                  value={memberQuantities[member.memberId] ?? ''}
                  onChange={(event) =>
                    setMemberQuantities((previous) => ({
                      ...previous,
                      [member.memberId]: event.target.value,
                    }))
                  }
                />
              ))}
            </Stack>

            <Box sx={{ display: { xs: 'block', md: 'none' }, width: '100%' }}>
              <DistributionSummaryBlock
                currencyCode={config.currencyCode}
                distributedTotal={distributedTotal}
                distributionLoadError={distributionLoadError}
                eggSaleCurrency={eggSaleCurrency}
                eggToSaleRate={eggToSaleRate}
                overLimit={overLimit}
                producedTotal={producedTotal}
                rateValidFrom={rateValidFrom}
                remaining={remaining}
              />
            </Box>
          </Box>
        ) : null}

        {!singleLayout && activeStep === 0 ? (
          <>
            <Stack spacing={2} sx={{ width: '100%' }}>
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
            {hasDistribution ? (
              <Box
                aria-hidden
                sx={{ display: { xs: 'none', md: 'block' }, minHeight: 1 }}
              />
            ) : null}
          </>
        ) : null}

        {!singleLayout && activeStep === 1 && hasDistribution ? (
          <>
            <Stack spacing={2} sx={{ width: '100%' }}>
              <DateInput fullWidth source="date" />
              <Typography variant="body1">
                {translate('app.bulk_quantity.distribution_produced', {
                  count: producedTotal,
                })}
              </Typography>
              {remaining >= 0 ? (
                <Typography variant="body1">
                  {translate('app.bulk_quantity.distribution_remaining', {
                    count: remaining,
                  })}
                </Typography>
              ) : null}
              {eggToSaleRate !== null && rateValidFrom ? (
                <Typography color="text.secondary" variant="body2">
                  {translate('app.bulk_quantity.distribution_rate', {
                    from: config.currencyCode,
                    to: eggSaleCurrency,
                    rate: eggToSaleRate,
                    date: rateValidFrom.slice(0, 10),
                  })}
                </Typography>
              ) : null}
              {distributionLoadError ? (
                <Alert severity="warning">{distributionLoadError}</Alert>
              ) : null}
              {overLimit ? (
                <Alert severity="warning">
                  {translate('app.bulk_quantity.distribution_over_limit', {
                    count: distributedTotal - producedTotal,
                  })}
                </Alert>
              ) : null}
              {distributionMembers.length === 0 ? (
                <Typography color="warning.main" variant="body2">
                  {translate('app.bulk_quantity.distribution_no_members', {
                    org: config.distribution?.memberOrganizationName ?? '',
                  })}
                </Typography>
              ) : null}
            </Stack>
            <Stack spacing={2} sx={{ width: '100%' }}>
              {distributionMembers.map((member) => (
                <TextField
                  key={member.memberId}
                  disabled={
                    memberNeedsSaleRate([member]) && eggToSaleRate === null
                  }
                  fullWidth
                  inputMode="numeric"
                  label={member.memberName}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      step: 1,
                      style: { fontSize: '1.25rem', padding: '14px 12px' },
                    },
                  }}
                  type="number"
                  value={memberQuantities[member.memberId] ?? ''}
                  onChange={(event) =>
                    setMemberQuantities((previous) => ({
                      ...previous,
                      [member.memberId]: event.target.value,
                    }))
                  }
                />
              ))}
            </Stack>
          </>
        ) : null}
      </SimpleForm>

      {resultRows.length > 0 || warnings.length > 0 || saveError ? (
        <Stack data-testid="bulk-quantity-results" spacing={1} sx={{ mt: 3 }}>
          <Typography variant="subtitle1">
            {translate('app.bulk_quantity.results_heading')}
          </Typography>
          {resultRows.map((row) => (
            <Alert
              key={`${row.group}:${row.groupKey}`}
              severity={row.created + row.updated > 0 ? 'success' : 'info'}
            >
              {row.label}: {resultMessage(row)}
            </Alert>
          ))}
          {warnings.map((warning) => (
            <Alert
              key={`${warning.code}:${warning.groupKey}`}
              severity="warning"
            >
              {warning.message}
            </Alert>
          ))}
          {saveError ? (
            <>
              <Alert severity="error">
                {translate('app.bulk_quantity.save_failed_nothing_saved')}{' '}
                {saveError.message}
              </Alert>
              <Button disabled={saving} variant="outlined" onClick={retry}>
                {translate('app.bulk_quantity.retry_failed')}
              </Button>
            </>
          ) : null}
        </Stack>
      ) : null}

      <PerRowConflictDialog
        choices={conflictChoices}
        conflicts={conflicts}
        open={conflictOpen}
        onCancel={() => setConflictOpen(false)}
        onChange={(groupKey, choice) =>
          setConflictChoices((previous) => ({
            ...previous,
            [groupKey]: choice,
          }))
        }
        onConfirm={confirmConflicts}
      />

      <GlobalConflictDialog
        choice={globalConflictChoice}
        conflicts={conflicts}
        open={globalConflictOpen}
        onCancel={() => setGlobalConflictOpen(false)}
        onChange={setGlobalConflictChoice}
        onConfirm={confirmGlobalConflicts}
      />
    </Box>
  );
}

function ConflictChoiceRadios({
  value,
  onChange,
}: {
  value: EggConflictChoice;
  onChange: (choice: EggConflictChoice) => void;
}) {
  const translate = useTranslate();
  return (
    <RadioGroup
      value={value}
      onChange={(_event, next) => onChange(next as EggConflictChoice)}
    >
      <FormControlLabel
        control={<Radio />}
        label={translate('app.bulk_quantity.conflict_update')}
        value="replace"
      />
      <FormControlLabel
        control={<Radio />}
        label={translate('app.bulk_quantity.conflict_insert')}
        value="add"
      />
      <FormControlLabel
        control={<Radio />}
        label={translate('app.bulk_quantity.conflict_skip')}
        value="skip"
      />
    </RadioGroup>
  );
}

function DistributionSummaryBlock({
  producedTotal,
  remaining,
  distributedTotal,
  overLimit,
  currencyCode,
  eggSaleCurrency,
  eggToSaleRate,
  rateValidFrom,
  distributionLoadError,
}: {
  producedTotal: number;
  remaining: number;
  distributedTotal: number;
  overLimit: boolean;
  currencyCode: string;
  eggSaleCurrency: string;
  eggToSaleRate: number | null;
  rateValidFrom: string | null;
  distributionLoadError: string | null;
}) {
  const translate = useTranslate();
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1">
        {translate('app.bulk_quantity.distribution_summary')}
      </Typography>
      <Typography variant="body1">
        {translate('app.bulk_quantity.distribution_produced', {
          count: producedTotal,
        })}
      </Typography>
      {remaining >= 0 ? (
        <Typography variant="body1">
          {translate('app.bulk_quantity.distribution_remaining', {
            count: remaining,
          })}
        </Typography>
      ) : null}
      {eggToSaleRate !== null && rateValidFrom ? (
        <Typography color="text.secondary" variant="body2">
          {translate('app.bulk_quantity.distribution_rate', {
            from: currencyCode,
            to: eggSaleCurrency,
            rate: eggToSaleRate,
            date: rateValidFrom.slice(0, 10),
          })}
        </Typography>
      ) : null}
      {distributionLoadError ? (
        <Alert severity="warning">{distributionLoadError}</Alert>
      ) : null}
      {overLimit ? (
        <Alert severity="warning">
          {translate('app.bulk_quantity.distribution_over_limit', {
            count: distributedTotal - producedTotal,
          })}
        </Alert>
      ) : null}
    </Stack>
  );
}

function PerRowConflictDialog({
  open,
  conflicts,
  choices,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  conflicts: EggConflict[];
  choices: Record<string, EggConflictChoice>;
  onChange: (groupKey: string, choice: EggConflictChoice) => void;
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
          {conflictGroups(conflicts).map((conflict) => (
            <Box key={conflict.groupKey}>
              <Typography sx={{ fontWeight: 600 }} variant="subtitle2">
                {conflict.label}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {translate('app.bulk_quantity.conflict_existing', {
                  amount: conflict.existingAmount,
                })}
              </Typography>
              <FormControl>
                <ConflictChoiceRadios
                  value={choices[conflict.groupKey] ?? 'replace'}
                  onChange={(choice) => onChange(conflict.groupKey, choice)}
                />
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

function GlobalConflictDialog({
  open,
  choice,
  conflicts,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  choice: EggConflictChoice;
  conflicts: EggConflict[];
  onChange: (choice: EggConflictChoice) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const translate = useTranslate();
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onCancel}>
      <DialogTitle>{translate('app.bulk_quantity.conflict_title')}</DialogTitle>
      <DialogContent>
        <Typography gutterBottom variant="body2">
          {translate('app.bulk_quantity.conflict_global_body')}
        </Typography>
        <Stack component="ul" spacing={0.5} sx={{ my: 1, pl: 2 }}>
          {conflictGroups(conflicts).map((conflict) => (
            <Typography key={conflict.groupKey} component="li" variant="body2">
              {conflict.label} —{' '}
              {translate('app.bulk_quantity.conflict_existing', {
                amount: conflict.existingAmount,
              })}
            </Typography>
          ))}
        </Stack>
        <FormControl sx={{ mt: 1 }}>
          <ConflictChoiceRadios value={choice} onChange={onChange} />
        </FormControl>
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
