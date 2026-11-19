import {
  AutocompleteInput,
  DateInput,
  ImageField,
  ImageInput,
  NumberInput,
  ReferenceInput,
  required,
  SelectInput,
  SimpleForm,
  TextInput,
  minValue,
  type SimpleFormProps,
} from 'react-admin';

import { bandedForm, bandedSpanClass } from '../../theme';
import {
  ASSET_CATEGORIES_RESOURCE,
  ASSET_OWNERSHIP_CHOICES,
  ASSET_STATUS_CHOICES,
  DEFAULT_ASSET_OWNERSHIP_TYPE,
  DEFAULT_ASSET_STATUS,
} from './assetConstants';
import { TransactionPickerInput } from './TransactionPickerInput';

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

function currencyOptionText(record: { code?: string; name?: string }) {
  return [record.code, record.name].filter(Boolean).join(' ');
}

/** Shared create / edit form ("Új eszköz" / "Eszköz szerkesztése"). */
export function AssetForm(props: Omit<SimpleFormProps, 'children'>) {
  return (
    <SimpleForm sx={bandedForm} {...props}>
      <TextInput fullWidth source="name" validate={required()} />
      <ReferenceInput
        perPage={200}
        reference={ASSET_CATEGORIES_RESOURCE}
        sort={{ field: 'sort_order', order: 'ASC' }}
        source="category"
      >
        <AutocompleteInput
          filterToQuery={nameFilterToQuery}
          fullWidth
          optionText="name"
        />
      </ReferenceInput>

      <SelectInput
        choices={ASSET_OWNERSHIP_CHOICES}
        defaultValue={DEFAULT_ASSET_OWNERSHIP_TYPE}
        fullWidth
        source="ownership_type"
        validate={required()}
      />
      <SelectInput
        choices={ASSET_STATUS_CHOICES}
        defaultValue={DEFAULT_ASSET_STATUS}
        fullWidth
        source="status"
        validate={required()}
      />

      <TransactionPickerInput side="debit" source="acquisition_transaction" />
      <TransactionPickerInput side="credit" source="disposal_transaction" />

      <NumberInput fullWidth source="purchase_price" validate={minValue(0)} />
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
        />
      </ReferenceInput>

      <DateInput fullWidth source="purchase_date" />
      <DateInput fullWidth source="warranty_until" />

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
          validate={required()}
        />
      </ReferenceInput>
      <ReferenceInput
        perPage={100}
        reference="members"
        sort={{ field: 'name', order: 'ASC' }}
        source="responsible_member"
      >
        <AutocompleteInput
          filterToQuery={nameFilterToQuery}
          fullWidth
          helperText="app.assets.responsible_member_help"
          optionText="name"
        />
      </ReferenceInput>

      <TextInput fullWidth source="location" />
      <TextInput fullWidth source="serial_number" />

      <TextInput
        className={bandedSpanClass}
        fullWidth
        multiline
        source="notes"
      />
      <ImageInput
        accept={{ 'image/*': [] }}
        className={bandedSpanClass}
        source="photo"
      >
        <ImageField source="src" title="title" />
      </ImageInput>
    </SimpleForm>
  );
}
