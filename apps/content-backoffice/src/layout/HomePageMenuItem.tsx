import { useCallback } from 'react';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  ListItemIcon,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material';
import clsx from 'clsx';
import { useSidebarState, useTranslate } from 'react-admin';

const MENU_ITEM_ROOT = 'RaMenuItemLink-root';
const MENU_ITEM_ICON = 'RaMenuItemLink-icon';
const EXTERNAL_ICON_CLASS = 'HomePageMenuItem-externalIcon';

export function HomePageMenuItem() {
  const translate = useTranslate();
  const [sidebarOpen, setSidebarOpen] = useSidebarState();
  const isSmall = useMediaQuery<Theme>((theme) => theme.breakpoints.down('md'));
  const label = translate('app.home');

  const handleClick = useCallback(() => {
    if (isSmall) {
      setSidebarOpen(false);
    }
  }, [isSmall, setSidebarOpen]);

  const item = (
    <MenuItem
      className={clsx(MENU_ITEM_ROOT)}
      component="a"
      href="/"
      rel="noopener noreferrer"
      onClick={handleClick}
      sx={{
        color: 'text.secondary',
        [`.RaMenu-closed & .${EXTERNAL_ICON_CLASS}`]: {
          display: 'none',
        },
      }}
    >
      <ListItemIcon className={MENU_ITEM_ICON}>
        <HomeOutlinedIcon fontSize="small" />
      </ListItemIcon>
      <Typography variant="inherit" noWrap sx={{ flexGrow: 1 }}>
        {label}
      </Typography>
      <OpenInNewIcon
        aria-hidden
        className={EXTERNAL_ICON_CLASS}
        fontSize="small"
        sx={{
          color: 'text.secondary',
          flexShrink: 0,
          ml: 0.5,
          opacity: 0.75,
        }}
      />
    </MenuItem>
  );

  if (sidebarOpen) {
    return item;
  }

  return (
    <Tooltip placement="right" title={label}>
      {item}
    </Tooltip>
  );
}
