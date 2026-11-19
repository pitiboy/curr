import { Box, Typography } from '@mui/material';
import {
  DateField,
  EditButton,
  FunctionField,
  ListButton,
  Show,
  SimpleShowLayout,
  TextField,
  TopToolbar,
  useLocaleState,
  useRecordContext,
  useTranslate,
} from 'react-admin';

import type { AssetRecord } from '../../data/assetData';
import { bandedShow, bandedSpanClass } from '../../theme';
import { dateFieldProps } from '../transactions/dateField';
import { ASSETS_RESOURCE } from './assetConstants';
import { EnumLabel, TransactionRefLink } from './assetDisplay';
import { amountFormat } from './assetFormat';
import { AssetPhotoThumb } from './AssetPhotoThumb';

function AssetPhoto() {
  const record = useRecordContext<AssetRecord>();
  const translate = useTranslate();
  if (!record?.photo) {
    return (
      <Box
        sx={{
          alignItems: 'center',
          color: 'text.secondary',
          display: 'flex',
          gap: 1.5,
          minHeight: 56,
        }}
      >
        <AssetPhotoThumb record={record} size={56} />
        <Typography variant="body2">
          {translate('app.assets.no_photo')}
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      alt={record.name}
      component="img"
      src={record.photo.url}
      sx={{
        bgcolor: 'action.hover',
        borderRadius: 1,
        display: 'block',
        maxHeight: 360,
        maxWidth: '100%',
        objectFit: 'contain',
      }}
    />
  );
}

function ShowActions() {
  return (
    <TopToolbar>
      <ListButton />
      <EditButton />
    </TopToolbar>
  );
}

function refName(
  record: AssetRecord,
  key: 'category' | 'organization' | 'responsible_member',
) {
  return record.refs?.[key]?.name ?? '—';
}

/** Eszköz részletei: adatok, fotó, beszerzési / selejtezési tranzakció. */
export function AssetShow() {
  const translate = useTranslate();
  const [locale] = useLocaleState();
  const label = (field: string) =>
    translate(`resources.assets.fields.${field}`);
  const dateProps = dateFieldProps(locale);
  return (
    <Show
      actions={<ShowActions />}
      resource={ASSETS_RESOURCE}
      title="app.assets.show_title"
    >
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <FunctionField<AssetRecord>
          className={bandedSpanClass}
          label={label('photo')}
          render={() => <AssetPhoto />}
        />
        <TextField source="name" />
        <FunctionField<AssetRecord>
          label={label('category')}
          render={(record) => refName(record, 'category')}
        />
        <FunctionField<AssetRecord>
          label={label('ownership_type')}
          render={(record) => (
            <EnumLabel kind="ownership_types" value={record.ownership_type} />
          )}
        />
        <FunctionField<AssetRecord>
          label={label('status')}
          render={(record) => (
            <EnumLabel kind="statuses" value={record.status} />
          )}
        />
        <FunctionField<AssetRecord>
          label={label('acquisition_transaction')}
          render={(record) => (
            <TransactionRefLink value={record.refs?.acquisition_transaction} />
          )}
        />
        <FunctionField<AssetRecord>
          label={label('disposal_transaction')}
          render={(record) => (
            <TransactionRefLink value={record.refs?.disposal_transaction} />
          )}
        />
        <FunctionField<AssetRecord>
          label={label('purchase_price')}
          render={(record) => (
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {record.purchase_price == null
                ? '—'
                : amountFormat.format(record.purchase_price)}
            </Box>
          )}
        />
        <FunctionField<AssetRecord>
          label={label('currency_type')}
          render={(record) => record.refs?.currency_type?.code ?? '—'}
        />
        <DateField emptyText="—" source="purchase_date" {...dateProps} />
        <DateField emptyText="—" source="warranty_until" {...dateProps} />
        <FunctionField<AssetRecord>
          label={label('organization')}
          render={(record) => refName(record, 'organization')}
        />
        <FunctionField<AssetRecord>
          label={label('responsible_member')}
          render={(record) => refName(record, 'responsible_member')}
        />
        <TextField emptyText="—" source="location" />
        <TextField emptyText="—" source="serial_number" />
        <TextField
          className={bandedSpanClass}
          emptyText="—"
          source="notes"
          sx={{ whiteSpace: 'pre-wrap' }}
        />
      </SimpleShowLayout>
    </Show>
  );
}
