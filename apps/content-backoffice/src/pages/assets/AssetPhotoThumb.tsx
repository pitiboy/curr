import { Avatar } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

import type { AssetRecord } from '../../data/assetData';

export function AssetPhotoThumb({
  record,
  size = 40,
}: {
  record: Pick<AssetRecord, 'photo' | 'name'> | undefined;
  size?: number;
}) {
  const photo = record?.photo;
  return (
    <Avatar
      alt={record?.name ?? ''}
      src={photo?.thumbnailUrl}
      sx={{ width: size, height: size, bgcolor: 'action.hover' }}
      variant="rounded"
    >
      <Inventory2OutlinedIcon color="disabled" fontSize="small" />
    </Avatar>
  );
}
