import CheckIcon from '@mui/icons-material/Check';
import { Box, Button, Typography } from '@mui/material';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  AutocompleteInput,
  Confirm,
  DateField,
  DateInput,
  FunctionField,
  NumberInput,
  ReferenceInput,
  required,
  SelectField,
  SimpleForm,
  SimpleShowLayout,
  TextField,
  TextInput,
  useBlocker,
  useCanBlock,
  useGetIdentity,
  useNotify,
  useRefresh,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import { attachTransactionReceipt } from '../../data/dataProvider';
import { receiptCardInvalid, receiptCount } from '../../data/receiptDraft';
import {
  samePersonPublishBlocked,
  strapiErrorMessage,
} from '../../data/transactionPublish';
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';
import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  firstReceiptVendor,
  type TransactionRow,
} from '../../data/transactionList';
import { bandedForm, bandedShow, bandedSpanClass } from '../../theme';
import { TransactionConvertSection } from './TransactionConvertSection';
import { TransactionFinalizeSection } from './TransactionFinalizeSection';
import { TransactionAccountProfileRow } from './TransactionAccountProfileRow';
import { dateFieldProps } from './dateField';
import { useAccountCatalog } from './useAccountCatalog';
import { ReceiptRail, type ReceiptCardValue } from './ReceiptFields';
import { shouldConfirmDraftLeave } from './transactionLeave';
import {
  hasDescriptionComment,
  visibleDescription,
} from './descriptionComment';
import { reviewFormRecord } from './transactionForm';

const requiredMark = required();

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

const convertedChoices = [
  { id: CONVERTED_EXPANDED, name: 'app.converted.expanded' },
  { id: CONVERTED_STORNO, name: 'app.converted.storno' },
  { id: CONVERTED_ORIGINAL, name: 'app.converted.original' },
];

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

function DescriptionInput() {
  const translate = useTranslate();
  const boxRef = useRef<HTMLDivElement>(null);
  const [inputRoot, setInputRoot] = useState<HTMLElement | null>(null);
  const { getValues, setValue } = useFormContext();
  const description = useWatch({ name: 'description' });
  const hasComments = hasDescriptionComment(description);

  useLayoutEffect(() => {
    const root = boxRef.current?.querySelector('.MuiInputBase-root');
    setInputRoot(root instanceof HTMLElement ? root : null);
  }, []);

  const clearComments = () => {
    const current = getValues('description');
    const next = visibleDescription(current);
    if (next === current) return;
    setValue('description', next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <Box className={bandedSpanClass} ref={boxRef}>
      <TextInput
        fullWidth
        multiline
        source="description"
        sx={{
          '& .MuiInputBase-root': { position: 'relative' },
          '& textarea': hasComments ? { paddingBottom: '48px' } : undefined,
        }}
        validate={requiredMark}
      />
      {hasComments && inputRoot
        ? createPortal(
            <Button
              size="small"
              startIcon={<CheckIcon />}
              sx={{
                bgcolor: 'background.paper',
                bottom: 8,
                maxWidth: 'calc(100% - 16px)',
                position: 'absolute',
                right: 8,
                zIndex: 1,
              }}
              type="button"
              variant="outlined"
              onClick={clearComments}
              onMouseDown={(event) => event.preventDefault()}
            >
              {translate('app.description_clear_comments')}
            </Button>,
            inputRoot,
          )
        : null}
    </Box>
  );
}

function ReviewEditableFields({
  catalog,
}: {
  catalog: ReturnType<typeof useAccountCatalog>;
}) {
  return (
    <>
      <DateInput fullWidth source="date" validate={requiredMark} />
      <ReferenceInput
        perPage={100}
        reference="organizations"
        sort={{ field: 'name', order: 'ASC' }}
        source="organization"
      >
        <AutocompleteInput
          filterToQuery={nameFilterToQuery}
          fullWidth
          optionText="name"
          validate={requiredMark}
        />
      </ReferenceInput>
      <NumberInput fullWidth source="amount" validate={requiredMark} />
      <ReferenceInput
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
      </ReferenceInput>
      <DescriptionInput />
      <TransactionAccountProfileRow
        accounts={catalog.accounts}
        defaultProfile=""
        failed={catalog.failed}
        isPending={catalog.isPending}
        requireAccounts
      />
    </>
  );
}

function DraftLeaveGuard() {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const canBlock = useCanBlock();
  if (!canBlock) return null;
  return <DraftLeaveBlocker />;
}

function DraftLeaveBlocker() {
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) =>
      shouldConfirmDraftLeave({
        isEditor: true,
        status: 'draft',
        currentPathname: currentLocation.pathname,
        nextPathname: nextLocation.pathname,
      }),
    [],
  );
  const blocker = useBlocker(shouldBlock);

  return (
    <Confirm
      cancel="app.transactions_leave_stay"
      confirm="app.transactions_leave_go"
      confirmColor="warning"
      content="app.transactions_leave_body"
      isOpen={blocker.state === 'blocked'}
      title="app.transactions_leave_title"
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}

function ReceiptAttachEditor({
  cards,
  onCardsChange,
  record,
}: {
  cards: ReceiptCardValue[];
  onCardsChange: (cards: ReceiptCardValue[]) => void;
  record: TransactionRow;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { getValues } = useFormContext();
  const [saving, setSaving] = useState(false);
  const pending = cards.filter((card) => card.file && card.file.size > 0);
  const values = getValues() as Record<string, unknown>;
  const formDescription =
    typeof values.description === 'string' ? values.description.trim() : '';
  const canSave = Boolean(
    pending.length > 0 &&
    !pending.some((card) => receiptCardInvalid(card)) &&
    formDescription &&
    values.date &&
    isFilled(values.amount),
  );

  const saveReceipts = () => {
    if (!canSave || saving) return;
    setSaving(true);
    Promise.all(
      pending.map((card) =>
        attachTransactionReceipt(record.documentId, {
          file: card.file as File,
          vendor: card.vendor,
          receiptTypeId: card.receiptTypeId,
          date: values.date,
          amount: values.amount,
          description: formDescription,
        }),
      ),
    )
      .then(() => {
        onCardsChange([]);
        notify('app.receipt_saved', { type: 'success' });
        refresh();
      })
      .catch((error: unknown) => {
        notify(strapiErrorMessage(error) || 'ra.notification.http_error', {
          type: 'error',
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <Box className={bandedSpanClass} sx={{ px: 1 }}>
      <ReceiptRail
        cards={cards}
        saved={record.receipts}
        onChange={onCardsChange}
      />
      {pending.length > 0 && !formDescription ? (
        <Typography color="error" variant="body2">
          {translate('app.receipt_description_required')}
        </Typography>
      ) : null}
      {pending.length > 0 ? (
        <Button
          disabled={!canSave || saving}
          sx={{ mt: 1 }}
          type="button"
          variant="contained"
          onClick={saveReceipts}
        >
          {translate('app.receipt_save')}
        </Button>
      ) : null}
    </Box>
  );
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}

export function TransactionReviewEditor({
  cards,
  locale,
  onCardsChange,
  record,
}: {
  cards: ReceiptCardValue[];
  locale: string;
  onCardsChange: (cards: ReceiptCardValue[]) => void;
  record: TransactionRow;
}) {
  const catalog = useAccountCatalog();
  const { publisherMustDiffer } = useBackofficeConfig();
  const { identity } = useGetIdentity();
  const flatRecord = useMemo(() => reviewFormRecord(record), [record]);
  const pendingReceipt = cards.some((card) => card.file && card.file.size > 0);
  const blocked =
    pendingReceipt || cards.some((card) => receiptCardInvalid(card));
  const missingReceipt = receiptCount(record.receipts) === 0;
  const editorEmail =
    identity && typeof identity.email === 'string' ? identity.email : '';
  const samePersonBlocked = useMemo(
    () =>
      samePersonPublishBlocked(
        record.entered_by,
        editorEmail,
        publisherMustDiffer,
      ),
    [record.entered_by, editorEmail, publisherMustDiffer],
  );

  return (
    <>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <FunctionField
          render={(row: RaRecord) => firstReceiptVendor(row.receipts) || '—'}
          source="vendor"
        />
        <SelectField choices={statusChoices} source="status" translateChoice />
        <SelectField
          choices={convertedChoices}
          emptyText="app.converted.none"
          source="converted_to_workflow"
          translateChoice
        />
      </SimpleShowLayout>
      <SimpleForm
        key={record.documentId}
        record={flatRecord}
        sx={bandedForm}
        toolbar={false}
        onSubmit={() => undefined}
      >
        <DraftLeaveGuard />
        <ReviewEditableFields catalog={catalog} />
        <ReceiptAttachEditor
          cards={cards}
          record={record}
          onCardsChange={onCardsChange}
        />
        <TransactionConvertSection record={record} />
        <TransactionFinalizeSection
          blocked={blocked}
          documentId={record.documentId}
          missingReceipt={missingReceipt}
          samePersonBlocked={samePersonBlocked}
        />
      </SimpleForm>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <TextField emptyText="—" source="entered_by" />
        <DateField source="createdAt" {...dateFieldProps(locale, true)} />
      </SimpleShowLayout>
    </>
  );
}
