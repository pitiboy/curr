import {
  Create,
  Datagrid,
  DeleteButton,
  Edit,
  List,
  NumberField,
  NumberInput,
  required,
  SaveButton,
  SimpleForm,
  TextField,
  TextInput,
  Toolbar,
} from 'react-admin';

import { ASSET_CATEGORIES_RESOURCE } from './assetConstants';

function CategoryForm({ withDelete = false }: { withDelete?: boolean }) {
  return (
    <SimpleForm
      toolbar={
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <SaveButton />
          {withDelete ? <DeleteButton mutationMode="pessimistic" /> : null}
        </Toolbar>
      }
    >
      <TextInput fullWidth source="name" validate={required()} />
      <TextInput fullWidth multiline source="description" />
      <NumberInput source="sort_order" />
    </SimpleForm>
  );
}

/** Eszköz kategóriák (controller). */
export function AssetCategoryList() {
  return (
    <List
      perPage={50}
      resource={ASSET_CATEGORIES_RESOURCE}
      sort={{ field: 'sort_order', order: 'ASC' }}
      title="app.asset_categories.list_title"
    >
      <Datagrid bulkActionButtons={false} rowClick="edit">
        <TextField source="name" />
        <TextField emptyText="—" source="description" />
        <NumberField emptyText="—" source="sort_order" />
      </Datagrid>
    </List>
  );
}

export function AssetCategoryCreate() {
  return (
    <Create
      redirect="list"
      resource={ASSET_CATEGORIES_RESOURCE}
      title="app.asset_categories.create_title"
    >
      <CategoryForm />
    </Create>
  );
}

export function AssetCategoryEdit() {
  return (
    <Edit
      mutationMode="pessimistic"
      redirect="list"
      resource={ASSET_CATEGORIES_RESOURCE}
      title="app.asset_categories.edit_title"
    >
      <CategoryForm withDelete />
    </Edit>
  );
}
