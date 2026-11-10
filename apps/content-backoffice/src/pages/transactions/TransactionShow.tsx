import { Box } from '@mui/material';
import { useState } from 'react';
import {
  DateField,
  FunctionField,
  ListButton,
  SelectField,
  Show,
  SimpleShowLayout,
  TextField,
  TopToolbar,
  useLocaleState,
  usePermissions,
  useRecordContext,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import { isEditorLikeRole } from '../../auth/roles';
import { receiptIsPresent } from '../../data/receiptDraft';
import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  firstReceiptVendor,
  type TransactionRow,
} from '../../data/transactionList';
import {
  bandedShow,
  bandedSpanClass,
  showBetweenBandsInset,
} from '../../theme';
import { AccountFieldLabel, AccountValue } from './accountField';
import { CurrencyValue } from './currencyField';
import { dateFieldProps } from './dateField';
import { DescriptionText } from './DescriptionText';
import { SavedReceiptSection, type ReceiptCardValue } from './ReceiptFields';
import { RelatedTransactionsAccordion } from './RelatedTransactionsAccordion';
import { TransactionReviewEditor } from './TransactionReviewEditor';

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

const convertedChoices = [
  { id: CONVERTED_EXPANDED, name: 'app.converted.expanded' },
  { id: CONVERTED_STORNO, name: 'app.converted.storno' },
  { id: CONVERTED_ORIGINAL, name: 'app.converted.original' },
];

function relationName(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const name = (value as { name?: string | null }).name;
  return name || '—';
}

function ShowActions() {
  return (
    <TopToolbar>
      <ListButton />
    </TopToolbar>
  );
}

export function TransactionShow() {
  return (
    <Show actions={<ShowActions />} title="app.transactions_show">
      <TransactionShowBody />
    </Show>
  );
}

function TransactionShowBody() {
  const record = useRecordContext<TransactionRow>();
  const { permissions, isPending } = usePermissions();
  const [locale] = useLocaleState();
  if (!record) return null;
  if (record.status === 'draft' && isPending) return null;
  const locales = locale === 'en' ? 'en' : 'hu-HU';
  const canReview =
    !isPending && isEditorLikeRole(permissions) && record.status === 'draft';

  if (canReview) {
    return (
      <TransactionShowReview
        key={String(record.id)}
        locale={locale}
        record={record}
      />
    );
  }

  return (
    <TransactionShowReadonly
      key={String(record.id)}
      locale={locale}
      locales={locales}
      record={record}
    />
  );
}

function TransactionShowReview({
  locale,
  record,
}: {
  locale: string;
  record: TransactionRow;
}) {
  const [cards, setCards] = useState<ReceiptCardValue[]>([]);
  return (
    <TransactionReviewEditor
      cards={cards}
      locale={locale}
      record={record}
      onCardsChange={setCards}
    />
  );
}

function TransactionShowReadonly({
  locale,
  locales,
  record,
}: {
  locale: string;
  locales: string;
  record: TransactionRow;
}) {
  const translate = useTranslate();
  const saved = hasSavedReceipts(record.receipts);

  return (
    <Box>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <FunctionField
          render={(row: RaRecord) => firstReceiptVendor(row.receipts) || '—'}
          source="vendor"
        />
        <FunctionField
          render={(row: RaRecord) => relationName(row.organization)}
          source="organization"
        />

        <DateField source="date" {...dateFieldProps(locale)} />
        <FunctionField
          label="resources.transactions.fields.amount"
          render={(row: RaRecord) => (
            <Box
              component="span"
              sx={{
                alignItems: 'center',
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 0.75,
                verticalAlign: 'middle',
              }}
            >
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatAmount(row.amount, locales)}
              </Box>
              <CurrencyValue value={row.currency_type} />
            </Box>
          )}
          source="amount"
        />
        <FunctionField
          render={(row: RaRecord) => (
            <DescriptionText value={row.description} />
          )}
          source="description"
        />

        <SelectField choices={statusChoices} source="status" translateChoice />
        <SelectField
          choices={convertedChoices}
          emptyText="app.converted.none"
          source="converted_to_workflow"
          translateChoice
        />
        {record.status === 'draft' ? (
          <FunctionField
            label="resources.transactions.fields.related_group"
            render={(row: RaRecord) =>
              formatRelatedGroup(row, locales, translate)
            }
            source="related_transactions"
          />
        ) : null}

        <FunctionField
          label={<AccountFieldLabel kind="credit" />}
          render={(row: RaRecord) => (
            <AccountValue kind="credit" value={row.credit_account} />
          )}
          source="credit_account"
        />
        <FunctionField
          label={<AccountFieldLabel kind="debit" />}
          render={(row: RaRecord) => (
            <AccountValue kind="debit" value={row.debit_account} />
          )}
          source="debit_account"
        />
        {!saved ? (
          <FunctionField
            className={bandedSpanClass}
            label="resources.transactions.fields.receipt"
            render={() => translate('app.receipt_no')}
            source="receipts"
          />
        ) : null}
      </SimpleShowLayout>
      {record.status === 'published' ? (
        <Box sx={showBetweenBandsInset}>
          <RelatedTransactionsAccordion
            locale={locale}
            locales={locales}
            record={record}
          />
        </Box>
      ) : null}
      {saved ? (
        <Box sx={showBetweenBandsInset}>
          <SavedReceiptSection receipts={record.receipts} />
        </Box>
      ) : null}
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <TextField emptyText="—" source="entered_by" />
        <DateField source="createdAt" {...dateFieldProps(locale, true)} />
        {record.status === 'published' ? (
          <TextField emptyText="—" source="published_by" />
        ) : null}
        {record.status === 'published' ? (
          <DateField
            emptyText="—"
            source="publishedAt"
            {...dateFieldProps(locale, true)}
          />
        ) : null}
      </SimpleShowLayout>
    </Box>
  );
}

function hasSavedReceipts(receipts: unknown): boolean {
  return (
    Array.isArray(receipts) && receipts.some((item) => receiptIsPresent(item))
  );
}

function formatRelatedGroup(
  row: RaRecord,
  locales: string,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string {
  const children = row.related_transactions;
  const parent = row.related_transaction;
  if (Array.isArray(children) && children.length > 0) {
    return translate('app.transactions_related_children', {
      count: children.length,
    });
  }
  if (parent && typeof parent === 'object') {
    const amount = (parent as { amount?: unknown }).amount;
    const date = (parent as { date?: string }).date;
    if (date || amount != null) {
      return translate('app.transactions_related_parent', {
        date: date ?? '—',
        amount: formatAmount(amount, locales),
      });
    }
    return translate('app.transactions_related_parent_short');
  }
  return '—';
}

function formatAmount(value: unknown, locales: string): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(locales).format(amount);
}
