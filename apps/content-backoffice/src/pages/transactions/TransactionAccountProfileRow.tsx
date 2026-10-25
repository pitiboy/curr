import {
  Box,
  FormControl,
  InputLabel,
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
import { bandedSpanClass } from '../../theme';
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';
import { AccountFieldLabel } from './accountField';

const requiredMark = required();

function profileLabelKey(profile: AccountProfile): string {
  if (profile === '') return 'app.account_profile_all';
  return `app.account_profile_${profile.replace(/-/g, '_')}`;
}

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

function ProfileAccountInput({
  accounts,
  failed,
  isPending,
  kind,
  profile,
  requireAccounts,
  source,
}: {
  accounts: AccountChoice[];
  failed: boolean;
  isPending: boolean;
  kind: 'debit' | 'credit';
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

export function TransactionAccountProfileRow({
  accounts,
  defaultProfile,
  failed,
  isPending,
  requireAccounts = false,
}: {
  accounts: AccountChoice[];
  defaultProfile: AccountProfile;
  failed: boolean;
  isPending: boolean;
  requireAccounts?: boolean;
}) {
  const { effective, ready } = useBackofficeConfig();
  const allowedProfiles = useMemo(
    () => selectableAccountProfilesWithAll(effective, ready),
    [effective, ready],
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
        profile={profile}
        requireAccounts={requireAccounts}
        source="credit_account"
      />
      <ProfileAccountInput
        accounts={accounts}
        failed={failed}
        isPending={isPending}
        kind="debit"
        profile={profile}
        requireAccounts={requireAccounts}
        source="debit_account"
      />
    </Box>
  );
}
