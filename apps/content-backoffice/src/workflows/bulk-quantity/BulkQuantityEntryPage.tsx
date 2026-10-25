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
import { strapiHttpClient } from 'ra-strapi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  DateInput,
  SaveButton,
  SimpleForm,
  Title,
  Toolbar,
  useDataProvider,
  useTranslate,
} from 'react-admin';

import { EGG_SALE_CURRENCY, STRAPI_URL } from '../../config';
import { bandedForm } from '../../theme';
import {
  distributionRowsFromQuantities,
  isOverDistributed,
  memberNeedsSaleRate,
  pickLatestCurrencyRate,
  remainingEggs,
  totalDistributed,
  totalProduced,
} from './distributionLogic';
import {
  buildDistributionLegList,
  legPlansWithGlobalChoice,
  legToTransactionPayload,
} from './distributionPlans';
import { findDuplicateForRow, findDuplicateForTransaction } from './duplicateFetch';
import { loadBulkQuantityCatalog } from './loadCatalog';
import {
  loadCurrencyRates,
  loadDistributionMembers,
  loadDistributionRefs,
} from './loadDistribution';
import {
  buildRowPlans,
  buildRowPlansWithGlobalChoice,
  buildTransactionPayload,
  failedRowIds,
  invalidQuantityInput,
  mergeRowResults,
  plansForRetry,
  rowsFromQuantities,
  todayIsoDate,
} from './logic';
import { executeLegPlans, executeRowPlans } from './saveRows';
import type {
  BulkQuantityConflictChoice,
  BulkQuantityDuplicate,
  BulkQuantityGlobalConflictChoice,
  BulkQuantityHenHouse,
  BulkQuantityResolvedRefs,
  BulkQuantityRowPlan,
  BulkQuantityRowResult,
  BulkQuantityWorkflowConfig,
  DistributionMember,
  DistributionResolvedRefs,
  DistributionTransactionLegPlan,
} from './types';

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
  disabled: boolean;
  saving: boolean;
  onProductionOnly: () => void;
  onNext: () => void;
  onBack: () => void;
  onSaveAll: () => void;
};

function WizardToolbar({
  activeStep,
  hasDistribution,
  disabled,
  saving,
  onProductionOnly,
  onNext,
  onBack,
  onSaveAll,
}: WizardToolbarProps) {
  const translate = useTranslate();
  return (
    <Toolbar>
      {activeStep === 0 && hasDistribution ? (
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
      {activeStep === 0 && !hasDistribution ? (
        <Button
          disabled={disabled || saving}
          type="submit"
          variant="contained"
        >
          {translate('app.bulk_quantity.save')}
        </Button>
      ) : null}
      {activeStep === 1 ? (
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

export function BulkQuantityEntryPage({
  config,
}: {
  config: BulkQuantityWorkflowConfig;
}) {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const hasDistribution = Boolean(config.distribution);

  const [activeStep, setActiveStep] = useState(0);
  const [henHouses, setHenHouses] = useState<BulkQuantityHenHouse[]>([]);
  const [refs, setRefs] = useState<BulkQuantityResolvedRefs | null>(null);
  const [distributionRefs, setDistributionRefs] =
    useState<DistributionResolvedRefs | null>(null);
  const [distributionMembers, setDistributionMembers] = useState<
    DistributionMember[]
  >([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogPending, setCatalogPending] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [memberQuantities, setMemberQuantities] = useState<
    Record<string, string>
  >({});
  const [results, setResults] = useState<BulkQuantityRowResult[]>([]);
  const [conflicts, setConflicts] = useState<BulkQuantityDuplicate[]>([]);
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, BulkQuantityConflictChoice>
  >({});
  const [globalConflictChoice, setGlobalConflictChoice] =
    useState<BulkQuantityGlobalConflictChoice>('update');
  const [pendingProductionPlans, setPendingProductionPlans] = useState<
    BulkQuantityRowPlan[]
  >([]);
  const [pendingLegPlans, setPendingLegPlans] = useState<
    DistributionTransactionLegPlan[]
  >([]);
  const [pendingIncludeDistribution, setPendingIncludeDistribution] =
    useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [globalConflictOpen, setGlobalConflictOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitDate, setSubmitDate] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(todayIsoDate());
  const [eggToSaleRate, setEggToSaleRate] = useState<number | null>(null);
  const [rateValidFrom, setRateValidFrom] = useState<string | null>(null);
  const [distributionLoadError, setDistributionLoadError] = useState<
    string | null
  >(null);

  useEffect(() => {
    let active = true;
    setCatalogPending(true);
    setCatalogError(null);

    const distribution = config.distribution;
    loadBulkQuantityCatalog(httpClient, STRAPI_URL, config)
      .then(async ({ henHouses: houses, refs: loadedRefs }) => {
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
        if (!distribution) {
          return;
        }
        const distRefs = await loadDistributionRefs(
          httpClient,
          STRAPI_URL,
          distribution,
          config.currencyCode,
        );
        if (!distRefs) {
          setCatalogError(translate('app.bulk_quantity.catalog_missing'));
          setDistributionRefs(null);
          return;
        }
        setDistributionRefs(distRefs);
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

  const refreshDistributionContext = useCallback(
    async (isoDate: string) => {
      if (!config.distribution || !distributionRefs) {
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
          EGG_SALE_CURRENCY,
          isoDate,
        );
        if (memberNeedsSaleRate(members) && !rate) {
          setEggToSaleRate(null);
          setRateValidFrom(null);
          setDistributionLoadError(
            translate('app.bulk_quantity.distribution_rate_missing', {
              from: config.currencyCode,
              to: EGG_SALE_CURRENCY,
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
    [config.currencyCode, config.distribution, distributionRefs, translate],
  );

  useEffect(() => {
    if (!hasDistribution || !distributionRefs || catalogPending) {
      return;
    }
    void refreshDistributionContext(formDate);
  }, [
    catalogPending,
    distributionRefs,
    formDate,
    hasDistribution,
    refreshDistributionContext,
  ]);

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

  const failedIds = useMemo(() => failedRowIds(results), [results]);

  const buildProductionPayload = useCallback(
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

  const runProductionPlans = useCallback(
    async (plans: BulkQuantityRowPlan[], date: string) => {
      setSaving(true);
      const batch = await executeRowPlans(dataProvider, plans, (plan) =>
        buildProductionPayload(plan, date),
      );
      setResults((previous) => mergeRowResults(previous, batch));
      setSaving(false);
    },
    [buildProductionPayload, dataProvider],
  );

  const runLegPlans = useCallback(
    async (plans: DistributionTransactionLegPlan[]) => {
      setSaving(true);
      const batch = await executeLegPlans(dataProvider, plans);
      setResults((previous) => mergeRowResults(previous, batch));
      setSaving(false);
    },
    [dataProvider],
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

  const buildLegPayloads = useCallback(
    (date: string, rate: number) => {
      if (!config.distribution || !distributionRefs) {
        return { legs: [], legPlans: [] as DistributionTransactionLegPlan[] };
      }
      const distRows = distributionRowsFromQuantities(
        distributionMembers.map((member) => ({
          memberId: member.memberId,
          memberName: member.memberName,
          membershipTypeName: member.membershipTypeName,
          membershipRules: member.membershipRules,
          membershipTypeRules: member.membershipTypeRules,
          memberAccountId: null,
        })),
        memberQuantities,
      );
      const legs = buildDistributionLegList({
        distributionRows: distRows,
        members: distributionMembers,
        distributionRefs,
        distributionConfig: config.distribution,
        eggToSaleRate: rate,
      });
      const buildPayload = (leg: (typeof legs)[number]) => {
        const description = translate(leg.descriptionKey, leg.descriptionParams);
        return legToTransactionPayload(leg, date, description);
      };
      return { legs, buildPayload, distRows };
    },
    [config.distribution, distributionMembers, distributionRefs, memberQuantities, translate],
  );

  const collectDuplicates = async (
    date: string,
    includeDistribution: boolean,
    rate: number,
  ): Promise<BulkQuantityDuplicate[]> => {
    if (!refs) {
      return [];
    }
    const duplicates: BulkQuantityDuplicate[] = [];
    const rows = rowsFromQuantities(henHouses, quantities);
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
    if (includeDistribution && config.distribution && distributionRefs) {
      const { legs } = buildLegPayloads(date, rate);
      for (const leg of legs) {
        const duplicate = await findDuplicateForTransaction(
          httpClient,
          STRAPI_URL,
          {
            date,
            organizationId: leg.organizationId,
            organizationLabel: leg.legKey,
            amount: leg.amount,
            currencyTypeId: leg.currencyTypeId,
            debitAccountId: leg.debitAccountId,
            creditAccountId: leg.creditAccountId,
          },
        );
        if (duplicate) {
          duplicates.push(duplicate);
        }
      }
    }
    return duplicates;
  };

  const buildSavePlans = (
    date: string,
    includeDistribution: boolean,
    rate: number,
    duplicates: BulkQuantityDuplicate[],
    choice: BulkQuantityGlobalConflictChoice,
  ) => {
    const rows = rowsFromQuantities(henHouses, quantities);
    const productionPlans = buildRowPlansWithGlobalChoice(
      rows,
      duplicates.filter((item) =>
        rows.some((row) => row.organizationId === item.row.organizationId),
      ),
      choice,
    );
    let legPlans: DistributionTransactionLegPlan[] = [];
    if (includeDistribution && config.distribution && distributionRefs) {
      const { legs, buildPayload } = buildLegPayloads(date, rate);
      legPlans = legPlansWithGlobalChoice(
        legs,
        duplicates.filter((item) =>
          legs.some((leg) => leg.legKey === item.row.organizationName),
        ),
        choice,
        buildPayload!,
      );
    }
    return { productionPlans, legPlans };
  };

  const prepareSave = async (
    date: string,
    includeDistribution: boolean,
    rate: number,
  ) => {
    const rows = rowsFromQuantities(henHouses, quantities);
    const duplicates = await collectDuplicates(date, includeDistribution, rate);
    setSubmitDate(date);
    setPendingIncludeDistribution(includeDistribution);

    if (hasDistribution) {
      const { productionPlans, legPlans } = buildSavePlans(
        date,
        includeDistribution,
        rate,
        duplicates,
        globalConflictChoice,
      );
      setPendingProductionPlans(productionPlans);
      setPendingLegPlans(legPlans);

      if (duplicates.length > 0) {
        setConflicts(duplicates);
        setGlobalConflictOpen(true);
        return { ready: false as const, productionPlans, legPlans };
      }
      return { ready: true as const, productionPlans, legPlans };
    }

    const defaultChoices = Object.fromEntries(
      duplicates.map((item) => [item.row.organizationId, 'update' as const]),
    );
    setConflictChoices(defaultChoices);
    const plans = buildRowPlans(rows, duplicates, defaultChoices);
    setPendingProductionPlans(plans);
    if (duplicates.length > 0) {
      setConflicts(duplicates);
      setConflictOpen(true);
      return {
        ready: false as const,
        productionPlans: plans,
        legPlans: [] as DistributionTransactionLegPlan[],
      };
    }
    return {
      ready: true as const,
      productionPlans: plans,
      legPlans: [] as DistributionTransactionLegPlan[],
    };
  };

  const submit = async (values: Record<string, unknown>) => {
    if (!refs) {
      return {};
    }
    const date = resolveDate(values.date);
    if (!date) {
      return { date: translate('ra.validation.required') };
    }
    setFormDate(date);
    const validationError = validateProductionInputs();
    if (validationError) {
      return validationError;
    }
    const prepared = await prepareSave(date, false, eggToSaleRate ?? 1);
    if (!prepared.ready) {
      return {};
    }
    await runProductionPlans(prepared.productionPlans, date);
    return {};
  };

  const handleProductionOnly = async () => {
    if (!refs) {
      return;
    }
    const validationError = validateProductionInputs();
    if (validationError) {
      return;
    }
    const date = formDate;
    setSubmitDate(date);
    const prepared = await prepareSave(date, false, eggToSaleRate ?? 1);
    if (!prepared.ready) {
      return;
    }
    await runProductionPlans(prepared.productionPlans, date);
  };

  const handleNext = async () => {
    if (!refs) {
      return;
    }
    const validationError = validateProductionInputs();
    if (validationError) {
      return;
    }
    await refreshDistributionContext(formDate);
    setActiveStep(1);
  };

  const handleSaveAll = async () => {
    if (!refs || overLimit) {
      return;
    }
    if (memberNeedsSaleRate(distributionMembers) && eggToSaleRate === null) {
      return;
    }
    for (const member of distributionMembers) {
      if (invalidQuantityInput(memberQuantities[member.memberId])) {
        return;
      }
    }
    const date = formDate;
    const prepared = await prepareSave(date, true, eggToSaleRate ?? 1);
    if (!prepared.ready) {
      return;
    }
    await runProductionPlans(prepared.productionPlans, date);
    if (prepared.legPlans.length > 0) {
      await runLegPlans(prepared.legPlans);
    }
  };

  const confirmGlobalConflicts = async () => {
    if (!submitDate) {
      return;
    }
    const { productionPlans, legPlans } = buildSavePlans(
      submitDate,
      pendingIncludeDistribution,
      eggToSaleRate ?? 1,
      conflicts,
      globalConflictChoice,
    );
    setPendingProductionPlans(productionPlans);
    setPendingLegPlans(legPlans);
    setGlobalConflictOpen(false);
    await runProductionPlans(productionPlans, submitDate);
    if (pendingIncludeDistribution && legPlans.length > 0) {
      await runLegPlans(legPlans);
    }
  };

  const confirmConflicts = async () => {
    if (!submitDate) {
      return;
    }
    const rows = pendingProductionPlans.map(
      ({ organizationId, organizationName, amount }) => ({
        organizationId,
        organizationName,
        amount,
      }),
    );
    const plans = buildRowPlans(rows, conflicts, conflictChoices);
    setPendingProductionPlans(plans);
    setConflictOpen(false);
    await runProductionPlans(plans, submitDate);
  };

  const retryFailed = async () => {
    if (!submitDate) {
      return;
    }
    const productionRetry = plansForRetry(pendingProductionPlans, failedIds);
    if (productionRetry.length > 0) {
      await runProductionPlans(productionRetry, submitDate);
    }
    const legRetry = pendingLegPlans.filter((plan) =>
      failedIds.includes(plan.legKey),
    );
    if (legRetry.length > 0) {
      await runLegPlans(legRetry);
    }
  };

  const stepDisabled =
    catalogPending ||
    !refs ||
    saving ||
    productionRows.length === 0 ||
    (activeStep === 1 &&
      (overLimit ||
        (memberNeedsSaleRate(distributionMembers) &&
          eggToSaleRate === null)));

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 640 }}>
      <Title title={config.labelKey} />
      {catalogError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {catalogError}
        </Alert>
      ) : null}
      {hasDistribution ? (
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
        defaultValues={{ date: todayIsoDate(), _bulkRowCount: 0 }}
        sx={bandedForm}
        toolbar={
          hasDistribution ? (
            <WizardToolbar
              activeStep={activeStep}
              disabled={stepDisabled}
              hasDistribution={hasDistribution}
              saving={saving}
              onBack={() => setActiveStep(0)}
              onNext={() => void handleNext()}
              onProductionOnly={() => void handleProductionOnly()}
              onSaveAll={() => void handleSaveAll()}
            />
          ) : (
            <Toolbar>
              <SaveButton
                disabled={
                  catalogPending || !refs || saving || productionRows.length === 0
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
        <DateInput fullWidth source="date" />

        {activeStep === 0 ? (
          <>
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
          </>
        ) : null}

        {activeStep === 1 && hasDistribution ? (
          <Stack spacing={2} sx={{ width: '100%' }}>
            <Typography variant="body1">
              {translate('app.bulk_quantity.distribution_produced', {
                count: producedTotal,
              })}
            </Typography>
            <Typography
              color={remaining < 0 ? 'error.main' : 'text.primary'}
              variant="body1"
            >
              {translate('app.bulk_quantity.distribution_remaining', {
                count: remaining,
              })}
            </Typography>
            {eggToSaleRate !== null && rateValidFrom ? (
              <Typography color="text.secondary" variant="body2">
                {translate('app.bulk_quantity.distribution_rate', {
                  from: config.currencyCode,
                  to: EGG_SALE_CURRENCY,
                  rate: eggToSaleRate,
                  date: rateValidFrom.slice(0, 10),
                })}
              </Typography>
            ) : null}
            {distributionLoadError ? (
              <Alert severity="warning">{distributionLoadError}</Alert>
            ) : null}
            {overLimit ? (
              <Alert severity="error">
                {translate('app.bulk_quantity.distribution_over_limit')}
              </Alert>
            ) : null}
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
        ) : null}
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
              onClick={() => void retryFailed()}
            >
              {translate('app.bulk_quantity.retry_failed')}
            </Button>
          ) : null}
        </Stack>
      ) : null}

      <PerRowConflictDialog
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
        onConfirm={() => void confirmConflicts()}
      />

      <GlobalConflictDialog
        choice={globalConflictChoice}
        open={globalConflictOpen}
        onCancel={() => setGlobalConflictOpen(false)}
        onChange={setGlobalConflictChoice}
        onConfirm={() => void confirmGlobalConflicts()}
      />
    </Box>
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

function GlobalConflictDialog({
  open,
  choice,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  choice: BulkQuantityGlobalConflictChoice;
  onChange: (choice: BulkQuantityGlobalConflictChoice) => void;
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
        <FormControl sx={{ mt: 1 }}>
          <RadioGroup
            value={choice}
            onChange={(_event, value) =>
              onChange(value as BulkQuantityGlobalConflictChoice)
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
