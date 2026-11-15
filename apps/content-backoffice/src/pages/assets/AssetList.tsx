import {
  AutocompleteInput,
  CreateButton,
  Datagrid,
  FilterButton,
  FunctionField,
  List,
  ReferenceInput,
  SearchInput,
  SelectInput,
  TextField,
  TopToolbar,
  useTranslate,
} from 'react-admin';

import type { AssetRecord } from '../../data/assetData';
import { AssetPhotoThumb } from './AssetPhotoThumb';
import {
  ASSET_CATEGORIES_RESOURCE,
  ASSET_OWNERSHIP_CHOICES,
  ASSET_STATUS_CHOICES,
  ASSETS_RESOURCE,
} from './assetConstants';
import { EnumLabel, TransactionRefLink } from './assetDisplay';
import { formatAssetPrice } from './assetFormat';

function nameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  return query ? { name: { $containsi: query } } : {};
}

const assetFilters = [
  <SearchInput alwaysOn key="q" source="q" />,
  <ReferenceInput
    key="category"
    perPage={200}
    reference={ASSET_CATEGORIES_RESOURCE}
    sort={{ field: 'sort_order', order: 'ASC' }}
    source="category"
  >
    <SelectInput optionText="name" />
  </ReferenceInput>,
  <SelectInput
    choices={ASSET_OWNERSHIP_CHOICES}
    key="ownership_type"
    source="ownership_type"
  />,
  <SelectInput choices={ASSET_STATUS_CHOICES} key="status" source="status" />,
  <ReferenceInput
    key="organization"
    perPage={100}
    reference="organizations"
    sort={{ field: 'name', order: 'ASC' }}
    source="organization"
  >
    <AutocompleteInput filterToQuery={nameFilterToQuery} optionText="name" />
  </ReferenceInput>,
];

function ListActions() {
  return (
    <TopToolbar>
      <FilterButton />
      <CreateButton />
    </TopToolbar>
  );
}

function ref(record: AssetRecord, key: keyof AssetRecord['refs']) {
  const value = record.refs?.[key] as { name?: string } | null | undefined;
  return value?.name ?? '—';
}

/** "Eszköznyilvántartás" */
export function AssetList() {
  const translate = useTranslate();
  const label = (field: string) =>
    translate(`resources.assets.fields.${field}`);
  return (
    <List
      actions={<ListActions />}
      filters={assetFilters}
      perPage={25}
      resource={ASSETS_RESOURCE}
      sort={{ field: 'name', order: 'ASC' }}
      sx={{ '& .RaList-content': { overflowX: 'auto' } }}
      title="app.assets.list_title"
    >
      <Datagrid bulkActionButtons={false} rowClick="show">
        <FunctionField<AssetRecord>
          label={label('photo')}
          render={(record) => <AssetPhotoThumb record={record} />}
          sortable={false}
        />
        <TextField source="name" />
        <FunctionField<AssetRecord>
          label={label('category')}
          render={(record) => ref(record, 'category')}
          sortBy="category"
          source="category"
        />
        <FunctionField<AssetRecord>
          label={label('ownership_type')}
          render={(record) => (
            <EnumLabel kind="ownership_types" value={record.ownership_type} />
          )}
          sortBy="ownership_type"
          source="ownership_type"
        />
        <FunctionField<AssetRecord>
          label={label('status')}
          render={(record) => (
            <EnumLabel kind="statuses" value={record.status} />
          )}
          sortBy="status"
          source="status"
        />
        <FunctionField<AssetRecord>
          label={label('responsible_member')}
          render={(record) => ref(record, 'responsible_member')}
          sortBy="responsible_member"
          source="responsible_member"
        />
        <TextField emptyText="—" source="location" />
        <FunctionField<AssetRecord>
          label={label('purchase_price')}
          render={(record) => formatAssetPrice(record)}
          sortBy="purchase_price"
          source="purchase_price"
          textAlign="right"
        />
        <TextField emptyText="—" source="purchase_date" />
        <TextField emptyText="—" source="warranty_until" />
        <FunctionField<AssetRecord>
          label={label('organization')}
          render={(record) => ref(record, 'organization')}
          sortBy="organization"
          source="organization"
        />
        <FunctionField<AssetRecord>
          label={label('acquisition_transaction')}
          render={(record) => (
            <TransactionRefLink value={record.refs?.acquisition_transaction} />
          )}
          sortBy="acquisition_transaction"
          source="acquisition_transaction"
        />
      </Datagrid>
    </List>
  );
}
