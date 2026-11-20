import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { useGetList, useTranslate } from 'react-admin';

import {
  accountChoiceLabel,
  filterAccountChoices,
  type AccountChoice,
} from '../../data/accountCodes';
import { KOR_TREASURY_ACCOUNT_CODE } from '../reports/assetReconciliation/constants';
import { useAccountCodePatterns } from '../../workflows/useAccountCodePatterns';
import { useAccountCatalog } from './useAccountCatalog';
import {
  roundLegAmountForCurrency,
  syncAmountFromPercent,
  syncPercentFromAmount,
  type EditableLegRow,
} from './convertPreviewEdit';

function AccountAutocomplete({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: AccountChoice[];
  disabled?: boolean;
  onChange: (documentId: string, code: string | null) => void;
}) {
  const selected =
    options.find((row) => String(row.id) === value) ??
    (value
      ? ({ id: value, code: value, name: null } satisfies AccountChoice)
      : null);

  return (
    <Autocomplete
      disabled={disabled}
      fullWidth
      options={options}
      getOptionLabel={(option) => accountChoiceLabel(option)}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      renderInput={(params) => (
        <TextField {...params} label={label} size="small" />
      )}
      size="small"
      value={selected}
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
  const patterns = useAccountCodePatterns();
  const { accounts } = useAccountCatalog();
  const debitOptions = useMemo(
    () => filterAccountChoices(accounts, 'debit', patterns),
    [accounts, patterns],
  );
  const creditOptions = useMemo(
    () => filterAccountChoices(accounts, 'credit', patterns),
    [accounts, patterns],
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

  return (
    <Box sx={{ overflowX: 'auto', width: '100%' }}>
      <Table size="small" sx={{ minWidth: 960 }}>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_kind')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_description')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_credit')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_debit')}
            </TableCell>
            <TableCell align="right">
              {translate('app.transactions_convert_preview_amount')}
            </TableCell>
            <TableCell align="right">
              {translate('app.transactions_convert_edit_percent')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_currency')}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const currency = currencyRows.find(
              (item) => item.id === row.currencyTypeDocumentId,
            ) as { code?: string | null } | undefined;
            const currencyCode = currency?.code ?? row.currencyCode ?? null;
            const debitChoices = filterTreasury1100(
              debitOptions,
              row,
              currencyCode,
            );
            const creditChoices = filterTreasury1100(
              creditOptions,
              row,
              currencyCode,
            );

            return (
              <TableRow key={row.key}>
                <TableCell>{row.kind === 'step' ? index : '—'}</TableCell>
                <TableCell>
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
                <TableCell sx={{ minWidth: 200 }}>
                  {row.locked ? (
                    row.description
                  ) : (
                    <TextField
                      fullWidth
                      multiline
                      size="small"
                      value={row.description}
                      onChange={(event) =>
                        patchRow(row.key, { description: event.target.value })
                      }
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  {row.locked ? (
                    `${row.creditCode}`
                  ) : (
                    <AccountAutocomplete
                      label={translate(
                        'app.transactions_convert_preview_credit',
                      )}
                      options={creditChoices}
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
                <TableCell sx={{ minWidth: 180 }}>
                  {row.locked ? (
                    `${row.debitCode}`
                  ) : (
                    <AccountAutocomplete
                      label={translate(
                        'app.transactions_convert_preview_debit',
                      )}
                      options={debitChoices}
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
                <TableCell align="right" sx={{ minWidth: 120 }}>
                  {row.locked ? (
                    row.amount.toLocaleString('hu-HU', {
                      maximumFractionDigits: 2,
                    })
                  ) : (
                    <TextField
                      inputProps={{ inputMode: 'decimal' }}
                      size="small"
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
                <TableCell align="right" sx={{ minWidth: 100 }}>
                  {row.locked || row.percent == null ? (
                    row.percent == null ? (
                      '—'
                    ) : (
                      `${row.percent}%`
                    )
                  ) : (
                    <TextField
                      inputProps={{ inputMode: 'decimal' }}
                      size="small"
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
                <TableCell sx={{ minWidth: 140 }}>
                  {row.locked ? (
                    (currencyCode ?? '—')
                  ) : (
                    <Autocomplete
                      fullWidth
                      options={currencyRows}
                      getOptionLabel={(option) =>
                        [option.code, option.name].filter(Boolean).join(' ')
                      }
                      isOptionEqualToValue={(left, right) =>
                        left.id === right.id
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={translate(
                            'app.transactions_convert_preview_currency',
                          )}
                          size="small"
                        />
                      )}
                      size="small"
                      value={
                        currencyRows.find(
                          (item) => item.id === row.currencyTypeDocumentId,
                        ) ?? null
                      }
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
                <TableCell>
                  {row.locked ? null : (
                    <Stack direction="row" spacing={0.5}>
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
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography color="text.secondary" variant="caption">
          {translate('app.transactions_convert_edit_extra_fields_hint')}
        </Typography>
        {rows
          .filter((row) => !row.locked && row.kind === 'step')
          .map((row) => (
            <Stack
              key={`${row.key}-extra`}
              spacing={1}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }}
            >
              <Typography variant="subtitle2">
                {translate('app.transactions_convert_edit_row_meta', {
                  key: row.key,
                })}
              </Typography>
              <TextField
                fullWidth
                InputLabelProps={{ shrink: true }}
                label={translate('app.transactions_field_date')}
                size="small"
                type="date"
                value={row.date?.slice(0, 10) ?? ''}
                onChange={(event) =>
                  patchRow(row.key, { date: event.target.value })
                }
              />
              <Autocomplete
                fullWidth
                options={organizations}
                getOptionLabel={(option) => String(option.name ?? option.id)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={translate('app.transactions_field_organization')}
                    size="small"
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
                    organizationDocumentId: option ? String(option.id) : null,
                  })
                }
              />
              <Autocomplete
                fullWidth
                options={transactionTypes}
                getOptionLabel={(option) => String(option.name ?? option.id)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={translate('app.transactions_field_type')}
                    size="small"
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
              <FormControlLabel
                control={
                  <Checkbox
                    checked={row.copyReceipt}
                    onChange={(event) =>
                      patchRow(row.key, { copyReceipt: event.target.checked })
                    }
                  />
                }
                label={translate('app.transactions_convert_edit_copy_receipt')}
              />
            </Stack>
          ))}
      </Stack>
    </Box>
  );
}
