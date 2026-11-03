import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { AutocompleteInput, required, useTranslate } from 'react-admin';

import {
  accountChoiceLabel,
  type AccountChoice,
} from '../../data/accountCodes';
import {
  accountChoicesForProfile,
  selectableAccountProfilesWithAll,
  type AccountProfile,
} from '../../data/accountProfiles';
import {
  buildAccountRowOptions,
  decodeAccountRowSelectValue,
  encodeAccountRowSelectValue,
  profileLabelKey,
  workflowTemplateSecondaryText,
  type AccountRowSelection,
} from '../../data/accountRowSelection';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { bandedSpanClass } from '../../theme';
import { useAccountCodePatterns } from '../../workflows/useAccountCodePatterns';
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';
import { AccountFieldLabel } from './accountField';
import {
  useOptionalTransactionCreateAccountRow,
  useTransactionCreateAccountRow,
} from './TransactionCreateAccountRowContext';
import { useWorkflowPrefillOnSelect } from './useWorkflowPrefill';

const requiredMark = required();

function AccountProfileSelect({
  allowedProfiles,
  profile,
  onProfileChange,
}: {
  allowedProfiles: AccountProfile[];
  profile: AccountProfile;
  onProfileChange: (profile: AccountProfile) => void;
}) {
  const translate = useTranslate();
  const label = translate('app.account_profile');

  return (
    <FormControl fullWidth>
      <InputLabel id="account-profile-label">{label}</InputLabel>
      <Select
        displayEmpty
        id="account-profile"
        label={label}
        labelId="account-profile-label"
        value={profile}
        onChange={(event) =>
          onProfileChange(event.target.value as AccountProfile)
        }
      >
        {allowedProfiles.map((option) => (
          <MenuItem key={option || 'all'} value={option}>
            {translate(profileLabelKey(option))}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function AccountRowTemplateSelect({
  allowedProfiles,
  effectiveSelection,
  onSelectionChange,
  transactionWorkflows,
  workflowsLoading,
}: {
  allowedProfiles: AccountProfile[];
  effectiveSelection: AccountRowSelection;
  onSelectionChange: (selection: AccountRowSelection) => void;
  transactionWorkflows: WorkflowTemplateHeader[];
  workflowsLoading: boolean;
}) {
  const translate = useTranslate();
  const label = translate('app.account_profile');

  const optionLabels = useMemo(
    () => ({
      groupProfiles: translate('app.account_profile_group_profiles'),
      groupWorkflows: translate('app.account_profile_group_workflows'),
      workflowsLoading: translate('app.account_profile_workflows_loading'),
      workflowSecondary: workflowTemplateSecondaryText,
    }),
    [translate],
  );

  const options = useMemo(
    () =>
      buildAccountRowOptions(
        allowedProfiles,
        transactionWorkflows,
        optionLabels,
        { workflowsLoading },
      ),
    [allowedProfiles, optionLabels, transactionWorkflows, workflowsLoading],
  );

  const profileOptions = options.filter((row) => row.kind === 'profile');
  const workflowOptions = options.filter(
    (row) => row.kind === 'workflow' || row.kind === 'workflows-loading',
  );
  const showWorkflowGroup =
    workflowsLoading || workflowOptions.some((row) => row.kind === 'workflow');

  const selectValue = encodeAccountRowSelectValue(effectiveSelection);

  return (
    <FormControl fullWidth>
      <InputLabel id="account-profile-label">{label}</InputLabel>
      <Select
        displayEmpty
        id="account-profile"
        label={label}
        labelId="account-profile-label"
        value={selectValue}
        onChange={(event) => {
          const decoded = decodeAccountRowSelectValue(
            String(event.target.value),
          );
          if (decoded) onSelectionChange(decoded);
        }}
      >
        <ListSubheader>{optionLabels.groupProfiles}</ListSubheader>
        {profileOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {translate(option.labelKey)}
          </MenuItem>
        ))}
        {showWorkflowGroup ? (
          <ListSubheader>{optionLabels.groupWorkflows}</ListSubheader>
        ) : null}
        {workflowOptions.map((option) => {
          if (option.kind === 'workflows-loading') {
            return (
              <MenuItem key={option.value} disabled value={option.value}>
                {translate(option.labelKey)}
              </MenuItem>
            );
          }
          return (
            <MenuItem key={option.value} value={option.value}>
              <Box
                sx={{
                  alignItems: 'flex-start',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                  width: '100%',
                }}
              >
                <Box
                  sx={{
                    alignItems: 'center',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    width: '100%',
                  }}
                >
                  <Typography component="span" variant="body2">
                    {option.label}
                  </Typography>
                  {option.hasCurrencyRestriction ? (
                    <Chip
                      label={translate(
                        'app.account_profile_workflow_chip_currency',
                      )}
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                  {option.hasTransactionTypeRestriction ? (
                    <Chip
                      label={translate(
                        'app.account_profile_workflow_chip_type',
                      )}
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                </Box>
                <Typography color="text.secondary" variant="caption">
                  {option.secondary}
                </Typography>
              </Box>
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
}

function ProfileAccountInput({
  accounts,
  failed,
  isPending,
  kind,
  patterns,
  profile,
  requireAccounts,
  source,
}: {
  accounts: AccountChoice[];
  failed: boolean;
  isPending: boolean;
  kind: 'debit' | 'credit';
  patterns: ReturnType<typeof useAccountCodePatterns>;
  profile: AccountProfile;
  requireAccounts: boolean;
  source: string;
}) {
  const translate = useTranslate();
  const selectedId = useWatch({ name: source });
  const choices = accountChoicesForProfile(
    accounts,
    kind,
    profile,
    selectedId,
    patterns,
  ).map((account) => ({
    id: account.id,
    name: accountChoiceLabel(account),
  }));

  return (
    <Box>
      <AutocompleteInput
        choices={choices}
        fullWidth
        isLoading={isPending}
        label={<AccountFieldLabel kind={kind} required={requireAccounts} />}
        source={source}
        translateChoice={false}
        validate={requireAccounts ? requiredMark : undefined}
      />
      {!isPending && !failed && choices.length === 0 ? (
        <Typography color="warning.main" variant="body2">
          {translate('app.accounts_seed_missing')}
        </Typography>
      ) : null}
    </Box>
  );
}

function TransactionAccountProfileRowWithWorkflows({
  accounts,
  failed,
  isPending,
  requireAccounts,
  transactionWorkflows,
  workflowsLoading,
}: {
  accounts: AccountChoice[];
  failed: boolean;
  isPending: boolean;
  requireAccounts?: boolean;
  transactionWorkflows: WorkflowTemplateHeader[];
  workflowsLoading: boolean;
}) {
  const translate = useTranslate();
  const { enabled, ready } = useBackofficeConfig();
  const patterns = useAccountCodePatterns();
  const { resolved, setStoredSelection } = useTransactionCreateAccountRow();
  const { prefillWarningKeys } = useWorkflowPrefillOnSelect(
    accounts,
    transactionWorkflows,
  );

  const allowedProfiles = useMemo(
    () => selectableAccountProfilesWithAll(enabled, ready),
    [enabled, ready],
  );

  useEffect(() => {
    if (
      resolved.effectiveSelection.kind === 'profile' &&
      !allowedProfiles.includes(resolved.effectiveSelection.profile)
    ) {
      setStoredSelection({ kind: 'profile', profile: '' });
    }
  }, [allowedProfiles, resolved.effectiveSelection, setStoredSelection]);

  return (
    <Box
      className={bandedSpanClass}
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
      }}
    >
      <Box>
        <AccountRowTemplateSelect
          allowedProfiles={allowedProfiles}
          effectiveSelection={resolved.effectiveSelection}
          transactionWorkflows={transactionWorkflows}
          workflowsLoading={workflowsLoading}
          onSelectionChange={setStoredSelection}
        />
        {prefillWarningKeys.map((key) => (
          <Alert key={key} severity="warning" sx={{ mt: 1 }} variant="outlined">
            {translate(key)}
          </Alert>
        ))}
        {resolved.workflowDropped ? (
          <Alert severity="info" sx={{ mt: 1 }} variant="outlined">
            {translate('app.account_profile_workflow_dropped')}
          </Alert>
        ) : null}
      </Box>
      <ProfileAccountInput
        accounts={accounts}
        failed={failed}
        isPending={isPending}
        kind="credit"
        patterns={patterns}
        profile={resolved.filterProfile}
        requireAccounts={requireAccounts ?? false}
        source="credit_account"
      />
      <ProfileAccountInput
        accounts={accounts}
        failed={failed}
        isPending={isPending}
        kind="debit"
        patterns={patterns}
        profile={resolved.filterProfile}
        requireAccounts={requireAccounts ?? false}
        source="debit_account"
      />
    </Box>
  );
}

function TransactionAccountProfileRowLegacy({
  accounts,
  defaultProfile,
  failed,
  isPending,
  requireAccounts,
}: {
  accounts: AccountChoice[];
  defaultProfile: AccountProfile;
  failed: boolean;
  isPending: boolean;
  requireAccounts?: boolean;
}) {
  const { enabled, ready } = useBackofficeConfig();
  const patterns = useAccountCodePatterns();
  const allowedProfiles = useMemo(
    () => selectableAccountProfilesWithAll(enabled, ready),
    [enabled, ready],
  );
  const [profile, setProfile] = useState<AccountProfile>(defaultProfile);

  useEffect(() => {
    if (!allowedProfiles.includes(profile)) {
      setProfile('');
    }
  }, [allowedProfiles, profile]);

  return (
    <Box
      className={bandedSpanClass}
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
      }}
    >
      <AccountProfileSelect
        allowedProfiles={allowedProfiles}
        profile={profile}
        onProfileChange={setProfile}
      />
      <ProfileAccountInput
        accounts={accounts}
        failed={failed}
        isPending={isPending}
        kind="credit"
        patterns={patterns}
        profile={profile}
        requireAccounts={requireAccounts ?? false}
        source="credit_account"
      />
      <ProfileAccountInput
        accounts={accounts}
        failed={failed}
        isPending={isPending}
        kind="debit"
        patterns={patterns}
        profile={profile}
        requireAccounts={requireAccounts ?? false}
        source="debit_account"
      />
    </Box>
  );
}

export function TransactionAccountProfileRow({
  accounts,
  defaultProfile,
  failed,
  isPending,
  requireAccounts = false,
  transactionWorkflowTemplates,
  transactionWorkflowsLoading = false,
}: {
  accounts: AccountChoice[];
  defaultProfile: AccountProfile;
  failed: boolean;
  isPending: boolean;
  requireAccounts?: boolean;
  /** When set, the Select also lists published transaction-workflow templates (Create only). */
  transactionWorkflowTemplates?: WorkflowTemplateHeader[];
  transactionWorkflowsLoading?: boolean;
}) {
  const createContext = useOptionalTransactionCreateAccountRow();
  const workflowMode =
    transactionWorkflowTemplates != null && createContext != null;

  if (workflowMode) {
    return (
      <TransactionAccountProfileRowWithWorkflows
        accounts={accounts}
        failed={failed}
        isPending={isPending}
        requireAccounts={requireAccounts}
        transactionWorkflows={transactionWorkflowTemplates}
        workflowsLoading={transactionWorkflowsLoading}
      />
    );
  }

  return (
    <TransactionAccountProfileRowLegacy
      accounts={accounts}
      defaultProfile={defaultProfile}
      failed={failed}
      isPending={isPending}
      requireAccounts={requireAccounts}
    />
  );
}
