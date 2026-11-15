import { Box, Typography } from '@mui/material';
import {
  EditButton,
  FunctionField,
  Labeled,
  Show,
  SimpleShowLayout,
  TextField,
  TopToolbar,
  useRecordContext,
  useTranslate,
} from 'react-admin';

import type { AssetRecord } from '../../data/assetData';
import { ASSETS_RESOURCE } from './assetConstants';
import { EnumLabel, TransactionRefLink } from './assetDisplay';
import { formatAssetPrice } from './assetFormat';

function AssetPhoto() {
  const record = useRecordContext<AssetRecord>();
  const translate = useTranslate();
  if (!record?.photo) {
    return (
      <Typography color="text.secondary" variant="body2">
        {translate('app.assets.no_photo')}
      </Typography>
    );
  }
  return (
    <Box
      alt={record.name}
      component="img"
      src={record.photo.url}
      sx={{
        maxWidth: '100%',
        maxHeight: 360,
        borderRadius: 1,
        objectFit: 'contain',
      }}
    />
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
  const label = (field: string) =>
    translate(`resources.assets.fields.${field}`);
  return (
    <Show
      actions={
        <TopToolbar>
          <EditButton />
        </TopToolbar>
      }
      resource={ASSETS_RESOURCE}
      title="app.assets.show_title"
    >
      <SimpleShowLayout>
        <Labeled label={label('photo')}>
          <AssetPhoto />
        </Labeled>
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
          label={label('purchase_price')}
          render={(record) => formatAssetPrice(record)}
        />
        <TextField emptyText="—" source="purchase_date" />
        <TextField emptyText="—" source="warranty_until" />
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
        <TextField
          emptyText="—"
          source="notes"
          sx={{ whiteSpace: 'pre-wrap' }}
        />
      </SimpleShowLayout>
    </Show>
  );
}
