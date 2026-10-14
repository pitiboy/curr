import { Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  Create,
  DateInput,
  NumberInput,
  ReferenceInput,
  required,
  SaveButton,
  SelectInput,
  SimpleForm,
  TextInput,
  Toolbar,
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

function currencyOptionText(record: RaRecord): string {
  const currency = record as { code?: string | null; name?: string | null };
  return [currency.code, currency.name].filter(Boolean).join(' ');
}

function DraftSaveToolbar() {
  return (
    <Toolbar>
      <SaveButton />
    </Toolbar>
  );
}

function useAccountCatalog() {
  const dataProvider = useDataProvider();
  const [accounts, setAccounts] = useState<AccountChoice[]>([]);
  const [isPending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAllAccounts((resource, params) => dataProvider.getList(resource, params))
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
  source,
}: {
  accounts: AccountChoice[];
  failed: boolean;
  isPending: boolean;
  kind: 'debit' | 'credit';
  source: string;
}) {
  const translate = useTranslate();
  const choices = filterAccountChoices(accounts, kind).map((account) => ({
    id: account.id,
    name: accountChoiceLabel(account),
  }));

  return (
    <>
      <SelectInput
        choices={choices}
        isLoading={isPending}
        source={source}
        validate={required()}
      />
      {!isPending && !failed && choices.length === 0 ? (
        <Typography color="warning.main" variant="body2">
          {translate('app.accounts_seed_missing')}
        </Typography>
      ) : null}
    </>
  );
}

/** Dataentry create. Save always goes out as a draft; there is no publish action. */
export function TransactionCreate() {
  const catalog = useAccountCatalog();

  return (
    <Create
      redirect="list"
      resource="transactions"
      title="app.transactions_create"
    >
      <SimpleForm toolbar={<DraftSaveToolbar />}>
        <DateInput source="date" validate={required()} />
        <NumberInput source="amount" validate={required()} />
        <ReferenceInput
          perPage={100}
          reference="currency-types"
          sort={{ field: 'code', order: 'ASC' }}
          source="currency_type"
        >
          <SelectInput optionText={currencyOptionText} validate={required()} />
        </ReferenceInput>
        <TextInput multiline source="description" />
        <ReferenceInput
          perPage={100}
          reference="organizations"
          sort={{ field: 'name', order: 'ASC' }}
          source="organization"
        >
          <SelectInput optionText="name" validate={required()} />
        </ReferenceInput>
        <AccountCodeInput
          accounts={catalog.accounts}
          failed={catalog.failed}
          isPending={catalog.isPending}
          kind="debit"
          source="debit_account"
        />
        <AccountCodeInput
          accounts={catalog.accounts}
          failed={catalog.failed}
          isPending={catalog.isPending}
          kind="credit"
          source="credit_account"
        />
      </SimpleForm>
    </Create>
  );
}
