import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  AutocompleteInput,
  DateInput,
  NumberInput,
  ReferenceInput,
  required,
  TextInput,
  useDataProvider,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import {
  accountChoiceLabel,
  filterAccountChoices,
  loadAllAccounts,
  type AccountChoice,
} from '../../data/accountCodes';
import { bandedSpanClass } from '../../theme';
import { AccountFieldLabel } from './accountField';

const requiredMark = required();

function currencyOptionText(record: RaRecord): string {
  const currency = record as { code?: string | null; name?: string | null };
  return [currency.code, currency.name].filter(Boolean).join(' ');
}

function nameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  return query ? { name: { $containsi: query } } : {};
}

function codeOrNameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  if (!query) return {};
  return {
    $or: [{ name: { $containsi: query } }, { code: { $containsi: query } }],
  };
}

export function useAccountCatalog() {
  const dataProvider = useDataProvider();
  const [accounts, setAccounts] = useState<AccountChoice[]>([]);
  const [isPending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAllAccounts((resource, params) =>
      dataProvider.getList(resource, params),
    )
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataProvider]);

  return { accounts, isPending, failed };
}

function AccountCodeInput({
  accounts,
  failed,
  isPending,
  kind,
  relationRequired,
  source,
}: {
  accounts: AccountChoice[];
  failed: boolean;
  isPending: boolean;
  kind: 'debit' | 'credit';
  relationRequired: boolean;
  source: string;
}) {
  const translate = useTranslate();
  const choices = filterAccountChoices(accounts, kind).map((account) => ({
    id: account.id,
    name: accountChoiceLabel(account),
  }));

  return (
    <Box>
      <AutocompleteInput
        choices={choices}
        fullWidth
        isLoading={isPending}
        label={<AccountFieldLabel kind={kind} required={relationRequired} />}
        source={source}
        translateChoice={false}
        validate={relationRequired ? requiredMark : undefined}
      />
      {!isPending && !failed && choices.length === 0 ? (
        <Typography color="warning.main" variant="body2">
          {translate('app.accounts_seed_missing')}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Shared create/review fields. `validate={required()}` only draws the asterisk. */
export function transactionFormFields({
  catalog,
  relationRequired,
}: {
  catalog: ReturnType<typeof useAccountCatalog>;
  relationRequired: boolean;
}) {
  return [
    <DateInput key="date" fullWidth source="date" validate={requiredMark} />,
    <ReferenceInput
      key="organization"
      perPage={100}
      reference="organizations"
      sort={{ field: 'name', order: 'ASC' }}
      source="organization"
    >
      <AutocompleteInput
        filterToQuery={nameFilterToQuery}
        fullWidth
        optionText="name"
        validate={relationRequired ? requiredMark : undefined}
      />
    </ReferenceInput>,
    <NumberInput key="amount" fullWidth source="amount" validate={requiredMark} />,
    <ReferenceInput
      key="currency_type"
      perPage={100}
      reference="currency-types"
      sort={{ field: 'code', order: 'ASC' }}
      source="currency_type"
    >
      <AutocompleteInput
        filterToQuery={codeOrNameFilterToQuery}
        fullWidth
        optionText={currencyOptionText}
        validate={requiredMark}
      />
    </ReferenceInput>,
    <TextInput
      key="description"
      className={bandedSpanClass}
      fullWidth
      multiline
      source="description"
      validate={requiredMark}
    />,
    <AccountCodeInput
      key="credit_account"
      accounts={catalog.accounts}
      failed={catalog.failed}
      isPending={catalog.isPending}
      kind="credit"
      relationRequired={relationRequired}
      source="credit_account"
    />,
    <AccountCodeInput
      key="debit_account"
      accounts={catalog.accounts}
      failed={catalog.failed}
      isPending={catalog.isPending}
      kind="debit"
      relationRequired={relationRequired}
      source="debit_account"
    />,
  ];
}
