import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  type SxProps,
  type Theme,
} from '@mui/material';
import { useMemo } from 'react';
import { useGetList, useTranslate } from 'react-admin';

import {
  accountChoiceLabel,
  sortAccountChoices,
  type AccountChoice,
} from '../../data/accountCodes';
import { KOR_TREASURY_ACCOUNT_CODE } from '../reports/assetReconciliation/constants';
import { useAccountCatalog } from './useAccountCatalog';
import {
  roundLegAmountForCurrency,
  syncAmountFromPercent,
  syncPercentFromAmount,
  type EditableLegRow,
} from './convertPreviewEdit';

/** Compact inputs: table headers carry the label, cells only show values. */
const denseFieldSx: SxProps<Theme> = {
  verticalAlign: 'baseline',
  '& .MuiInputBase-root': {
    fontSize: '0.8125rem',
    minHeight: 30,
    alignItems: 'baseline',
  },
  '& .MuiInputBase-input': {
    py: '5px',
    px: 0.75,
  },
  '& .MuiAutocomplete-inputRoot': {
    flexWrap: 'nowrap',
    pr: '28px !important',
  },
  '& .MuiAutocomplete-input': {
    minWidth: '4ch !important',
  },
};

const numberFieldSx: SxProps<Theme> = {
  ...denseFieldSx,
  '& input[type=number]': {
    MozAppearance: 'textfield',
    textAlign: 'right',
  },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
    {
      WebkitAppearance: 'none',
      margin: 0,
    },
};

const denseCellSx: SxProps<Theme> = {
  py: 0.5,
  px: 0.75,
  verticalAlign: 'bottom',
};

function resolveAccountChoice(
  catalog: AccountChoice[],
  documentId: string,
): AccountChoice | null {
  if (!documentId) return null;
  return (
    catalog.find((row) => String(row.id) === documentId) ?? {
      id: documentId,
      code: null,
      name: null,
    }
  );
}

function AccountAutocomplete({
  ariaLabel,
  value,
  options,
  catalog,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: AccountChoice[];
  catalog: AccountChoice[];
  onChange: (documentId: string, code: string | null) => void;
}) {
  const selected = resolveAccountChoice(catalog, value);
  const mergedOptions = useMemo(() => {
    const current = resolveAccountChoice(catalog, value);
    if (!current) return options;
    if (options.some((row) => String(row.id) === String(current.id))) {
      return options;
    }
    return sortAccountChoices([current, ...options]);
  }, [catalog, options, value]);

  return (
    <Autocomplete
      disableClearable={Boolean(selected)}
      fullWidth
      options={mergedOptions}
      getOptionLabel={(option) => {
        const labelText = accountChoiceLabel(option);
        return labelText || String(option.name ?? option.id);
      }}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      renderInput={(params) => (
        <TextField
          {...params}
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel,
          }}
          size="small"
          sx={denseFieldSx}
        />
      )}
      size="small"
      value={selected ?? undefined}
      onChange={(_event, option) => {
        onChange(String(option?.id ?? ''), option?.code ?? null);
      }}
    />
  );
}

function filterTreasury1100(
  options: AccountChoice[],
  row: EditableLegRow,
  currencyCode: string | null,
): AccountChoice[] {
  const baselineHas1100 =
    row.debitCode === KOR_TREASURY_ACCOUNT_CODE ||
    row.creditCode === KOR_TREASURY_ACCOUNT_CODE;
  if (baselineHas1100) return options;
  if (currencyCode?.trim().toUpperCase() !== 'KOR') return options;
  return options.filter(
    (choice) => String(choice.code ?? '').trim() !== KOR_TREASURY_ACCOUNT_CODE,
  );
}

function accountDisplayLabel(
  catalog: AccountChoice[],
  documentId: string,
  fallbackCode: string,
): string {
  const choice = resolveAccountChoice(catalog, documentId);
  if (!choice) return fallbackCode || '—';
  const labeled = accountChoiceLabel({
    ...choice,
    code: choice.code ?? fallbackCode,
  });
  if (labeled) return labeled;
  if (choice.name) return String(choice.name);
  if (fallbackCode) return fallbackCode;
  return String(choice.id);
}

function relationName(
  rows: { id?: unknown; name?: unknown }[],
  documentId: string | null,
): string {
  if (!documentId) return '—';
  const match = rows.find((row) => String(row.id) === documentId);
  return match ? String(match.name ?? match.id) : '—';
}

export function ConvertPreviewEditableTable({
  rows,
  sourceAmount,
  onChange,
  onDuplicate,
  onDelete,
}: {
  rows: EditableLegRow[];
  sourceAmount: number;
  onChange: (next: EditableLegRow[]) => void;
  onDuplicate: (row: EditableLegRow) => void;
  onDelete: (key: string) => void;
}) {
  const translate = useTranslate();
  const { accounts } = useAccountCatalog();
  // Expansion legs may use any ledger account (member / balance sheet), not
  // only the create-form debit/credit code patterns.
  const accountOptions = useMemo(
    () => sortAccountChoices(accounts),
    [accounts],
  );
  const { data: currencyRows = [] } = useGetList('currency-types', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'code', order: 'ASC' },
  });
  const { data: organizations = [] } = useGetList('organizations', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'name', order: 'ASC' },
  });
  const { data: transactionTypes = [] } = useGetList('transaction-types', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'name', order: 'ASC' },
  });

  const patchRow = (key: string, patch: Partial<EditableLegRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const editableSteps = rows.filter(
    (row) => !row.locked && row.kind === 'step',
  );

  const creditLabel = translate('app.transactions_convert_preview_credit');
  const debitLabel = translate('app.transactions_convert_preview_debit');
  const currencyLabel = translate('app.transactions_convert_preview_currency');
  const orgLabel = translate('resources.transactions.fields.organization');
  const typeLabel = translate('resources.transactions.fields.transaction_type');
  const copyReceiptLabel = translate(
    'app.transactions_convert_edit_copy_receipt',
  );

  return (
    <Box sx={{ overflowX: 'auto', width: '100%' }}>
      <Table
        size="small"
        sx={{
          minWidth: 1560,
          '& .MuiTableCell-root': denseCellSx,
          '& .MuiTableCell-head': {
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          },
          '& .MuiAutocomplete-root, & .MuiFormControl-root, & .MuiCheckbox-root':
            {
              verticalAlign: 'baseline',
            },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_kind')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_description')}
            </TableCell>
            <TableCell>{creditLabel}</TableCell>
            <TableCell>{debitLabel}</TableCell>
            <TableCell align="right">
              {translate('app.transactions_convert_preview_amount')}
            </TableCell>
            <TableCell align="right">
              {translate('app.transactions_convert_edit_percent')}
            </TableCell>
            <TableCell>{currencyLabel}</TableCell>
            <TableCell>
              {translate('resources.transactions.fields.date')}
            </TableCell>
            <TableCell>{orgLabel}</TableCell>
            <TableCell>{typeLabel}</TableCell>
            <TableCell align="center">
              <Tooltip title={copyReceiptLabel}>
                <span>
                  {translate(
                    'app.transactions_convert_edit_copy_receipt_short',
                  )}
                </span>
              </Tooltip>
            </TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const currency = currencyRows.find(
              (item) => item.id === row.currencyTypeDocumentId,
            ) as { code?: string | null } | undefined;
            const currencyCode = currency?.code ?? row.currencyCode ?? null;
            const choices = filterTreasury1100(
              accountOptions,
              row,
              currencyCode,
            );
            const stepNumber =
              row.kind === 'step'
                ? editableSteps.findIndex((step) => step.key === row.key) + 1
                : 0;
            const selectedCurrency =
              currencyRows.find(
                (item) => item.id === row.currencyTypeDocumentId,
              ) ?? null;

            return (
              <TableRow key={row.key}>
                <TableCell>
                  {row.kind === 'step' && stepNumber > 0 ? stepNumber : '—'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {row.kind === 'original'
                    ? translate(
                        'app.transactions_convert_preview_kind_original',
                      )
                    : row.kind === 'storno'
                      ? translate(
                          'app.transactions_convert_preview_kind_storno',
                        )
                      : translate('app.transactions_convert_preview_kind_step')}
                </TableCell>
                <TableCell sx={{ minWidth: 168 }}>
                  {row.locked ? (
                    row.description
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      sx={denseFieldSx}
                      value={row.description}
                      onChange={(event) =>
                        patchRow(row.key, { description: event.target.value })
                      }
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 168, maxWidth: 220 }}>
                  {row.locked ? (
                    accountDisplayLabel(
                      accounts,
                      row.creditAccountDocumentId,
                      row.creditCode,
                    )
                  ) : (
                    <AccountAutocomplete
                      ariaLabel={creditLabel}
                      catalog={accounts}
                      options={choices}
                      value={row.creditAccountDocumentId}
                      onChange={(documentId, code) =>
                        patchRow(row.key, {
                          creditAccountDocumentId: documentId,
                          creditCode: code ?? '',
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 168, maxWidth: 220 }}>
                  {row.locked ? (
                    accountDisplayLabel(
                      accounts,
                      row.debitAccountDocumentId,
                      row.debitCode,
                    )
                  ) : (
                    <AccountAutocomplete
                      ariaLabel={debitLabel}
                      catalog={accounts}
                      options={choices}
                      value={row.debitAccountDocumentId}
                      onChange={(documentId, code) =>
                        patchRow(row.key, {
                          debitAccountDocumentId: documentId,
                          debitCode: code ?? '',
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 108, width: 112 }}>
                  {row.locked ? (
                    row.amount.toLocaleString('hu-HU', {
                      maximumFractionDigits: 2,
                    })
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'decimal',
                          'aria-label': translate(
                            'app.transactions_convert_preview_amount',
                          ),
                        },
                      }}
                      sx={numberFieldSx}
                      type="number"
                      value={row.amount}
                      onChange={(event) => {
                        const amount = roundLegAmountForCurrency(
                          Number(event.target.value),
                          currencyCode,
                        );
                        const next = syncPercentFromAmount(
                          { ...row, amount },
                          sourceAmount,
                        );
                        patchRow(row.key, next);
                      }}
                    />
                  )}
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 72, width: 76 }}>
                  {row.locked || row.percent == null ? (
                    row.percent == null ? (
                      '—'
                    ) : (
                      `${row.percent}%`
                    )
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'decimal',
                          'aria-label': translate(
                            'app.transactions_convert_edit_percent',
                          ),
                        },
                      }}
                      sx={numberFieldSx}
                      type="number"
                      value={row.percent}
                      onChange={(event) => {
                        const percent = Number(event.target.value);
                        const next = syncAmountFromPercent(
                          { ...row, percent },
                          sourceAmount,
                        );
                        patchRow(row.key, next);
                      }}
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 72, width: 80 }}>
                  {row.locked ? (
                    (currencyCode ?? '—')
                  ) : (
                    <Autocomplete
                      disableClearable={Boolean(selectedCurrency)}
                      fullWidth
                      options={currencyRows}
                      getOptionLabel={(option) =>
                        String(option.code ?? option.name ?? option.id)
                      }
                      isOptionEqualToValue={(left, right) =>
                        left.id === right.id
                      }
                      renderOption={(props, option) => (
                        <li {...props} key={String(option.id)}>
                          {[option.code, option.name].filter(Boolean).join(' ')}
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          inputProps={{
                            ...params.inputProps,
                            'aria-label': currencyLabel,
                          }}
                          size="small"
                          sx={denseFieldSx}
                        />
                      )}
                      size="small"
                      value={selectedCurrency ?? undefined}
                      onChange={(_event, option) => {
                        patchRow(row.key, {
                          currencyTypeDocumentId: String(option?.id ?? ''),
                          currencyCode:
                            typeof option?.code === 'string'
                              ? option.code
                              : null,
                          amount: roundLegAmountForCurrency(
                            row.amount,
                            typeof option?.code === 'string'
                              ? option.code
                              : null,
                          ),
                        });
                      }}
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 128, width: 132 }}>
                  {row.locked ? (
                    (row.date?.slice(0, 10) ?? '—')
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      slotProps={{
                        htmlInput: {
                          'aria-label': translate(
                            'resources.transactions.fields.date',
                          ),
                        },
                      }}
                      sx={denseFieldSx}
                      type="date"
                      value={row.date?.slice(0, 10) ?? ''}
                      onChange={(event) =>
                        patchRow(row.key, { date: event.target.value })
                      }
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 140, maxWidth: 180 }}>
                  {row.locked ? (
                    relationName(organizations, row.organizationDocumentId)
                  ) : (
                    <Autocomplete
                      fullWidth
                      options={organizations}
                      getOptionLabel={(option) =>
                        String(option.name ?? option.id)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          inputProps={{
                            ...params.inputProps,
                            'aria-label': orgLabel,
                          }}
                          size="small"
                          sx={denseFieldSx}
                        />
                      )}
                      size="small"
                      value={
                        organizations.find(
                          (org) => org.id === row.organizationDocumentId,
                        ) ?? null
                      }
                      onChange={(_event, option) =>
                        patchRow(row.key, {
                          organizationDocumentId: option
                            ? String(option.id)
                            : null,
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 120, maxWidth: 160 }}>
                  {row.locked ? (
                    relationName(
                      transactionTypes,
                      row.transactionTypeDocumentId,
                    )
                  ) : (
                    <Autocomplete
                      fullWidth
                      options={transactionTypes}
                      getOptionLabel={(option) =>
                        String(option.name ?? option.id)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          inputProps={{
                            ...params.inputProps,
                            'aria-label': typeLabel,
                          }}
                          size="small"
                          sx={denseFieldSx}
                        />
                      )}
                      size="small"
                      value={
                        transactionTypes.find(
                          (type) => type.id === row.transactionTypeDocumentId,
                        ) ?? null
                      }
                      onChange={(_event, option) =>
                        patchRow(row.key, {
                          transactionTypeDocumentId: option
                            ? String(option.id)
                            : null,
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell align="center" sx={{ width: 48 }}>
                  {row.locked ? (
                    row.copyReceipt ? (
                      translate('ra.boolean.true')
                    ) : (
                      '—'
                    )
                  ) : (
                    <Tooltip title={copyReceiptLabel}>
                      <Checkbox
                        checked={row.copyReceipt}
                        inputProps={{
                          'aria-label': copyReceiptLabel,
                        }}
                        size="small"
                        onChange={(event) =>
                          patchRow(row.key, {
                            copyReceipt: event.target.checked,
                          })
                        }
                      />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {row.locked ? null : (
                    <Stack direction="row" spacing={0.25}>
                      <Button size="small" onClick={() => onDuplicate(row)}>
                        {translate('app.transactions_convert_edit_duplicate')}
                      </Button>
                      <Button
                        color="error"
                        size="small"
                        onClick={() => onDelete(row.key)}
                      >
                        {translate('app.transactions_convert_edit_delete')}
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
