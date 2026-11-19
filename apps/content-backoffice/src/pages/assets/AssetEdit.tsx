import {
  DeleteButton,
  Edit,
  SaveButton,
  Toolbar,
  usePermissions,
} from 'react-admin';

import { canPurgeExpansion } from '../../auth/roles';
import { AssetForm } from './AssetForm';
import { ASSETS_RESOURCE } from './assetConstants';

function AssetEditToolbar() {
  const { permissions } = usePermissions();
  return (
    <Toolbar sx={{ justifyContent: 'space-between' }}>
      <SaveButton />
      {/* Delete is controller-only (same rule as transactions). */}
      {canPurgeExpansion(permissions) ? (
        <DeleteButton mutationMode="pessimistic" />
      ) : null}
    </Toolbar>
  );
}

/** "Eszköz szerkesztése". */
export function AssetEdit() {
  return (
    <Edit
      mutationMode="pessimistic"
      redirect="show"
      resource={ASSETS_RESOURCE}
      title="app.assets.edit_title"
    >
      <AssetForm toolbar={<AssetEditToolbar />} />
    </Edit>
  );
}
