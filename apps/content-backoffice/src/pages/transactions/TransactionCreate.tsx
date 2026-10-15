import { Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  AutocompleteInput,
  Create,
  DateInput,
  NumberInput,
  ReferenceInput,
  required,
  SaveButton,
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
import { ReceiptFields } from './ReceiptFields';

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
      <AutocompleteInput
        choices={choices}
        isLoading={isPending}
        source={source}
        translateChoice={false}
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
  const translate = useTranslate();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptVendor, setReceiptVendor] = useState('');

  return (
    <Create
      redirect="list"
      resource="transactions"
      title="app.transactions_create"
      transform={(data) => ({
        ...data,
        receipt_file: receiptFile,
        receipt_vendor: receiptVendor,
      })}
    >
      <SimpleForm
        toolbar={<DraftSaveToolbar />}
        validate={(values: { description?: unknown }) => {
          const description =
            typeof values.description === 'string' ? values.description.trim() : '';
          if (receiptFile && receiptFile.size > 0 && !description) {
            return {
              description: translate('app.receipt_description_required'),
            };
          }
          return {};
        }}
      >
        <DateInput source="date" validate={required()} />
        <NumberInput source="amount" validate={required()} />
        <ReferenceInput
          perPage={100}
          reference="currency-types"
          sort={{ field: 'code', order: 'ASC' }}
          source="currency_type"
        >
          <AutocompleteInput
            filterToQuery={codeOrNameFilterToQuery}
            optionText={currencyOptionText}
            validate={required()}
          />
        </ReferenceInput>
        <TextInput multiline source="description" />
        <ReferenceInput
          perPage={100}
          reference="organizations"
          sort={{ field: 'name', order: 'ASC' }}
          source="organization"
        >
          <AutocompleteInput
            filterToQuery={nameFilterToQuery}
            optionText="name"
            validate={required()}
          />
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
        <ReceiptFields
          file={receiptFile}
          vendor={receiptVendor}
          onFile={setReceiptFile}
          onVendor={setReceiptVendor}
        />
      </SimpleForm>
    </Create>
  );
}
