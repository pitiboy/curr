import { Create } from 'react-admin';

import { AssetForm } from './AssetForm';
import { ASSETS_RESOURCE } from './assetConstants';

/** "Új eszköz". `?source=` (workflow redirect) prefills the form. */
export function AssetCreate() {
  return (
    <Create
      redirect="show"
      resource={ASSETS_RESOURCE}
      title="app.assets.create_title"
    >
      <AssetForm />
    </Create>
  );
}
