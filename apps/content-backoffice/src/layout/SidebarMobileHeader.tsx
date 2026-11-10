import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { useSidebarState, useTranslate } from 'react-admin';

import { useAppTitle } from './AppTitle';
import { useRaPageTitle } from './useRaPageTitle';

/** Shown at the top of the drawer menu on small screens (titles removed from the app bar). */
export function SidebarMobileHeader() {
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down('sm'),
  );
  const appTitle = useAppTitle();
  const pageTitle = useRaPageTitle();
  const [, setOpen] = useSidebarState();
  const translate = useTranslate();
  const closeLabel = translate('app.sidebar.close');

  if (!isMobile) {
    return null;
  }

  return (
    <Box
      sx={{
        alignItems: 'flex-start',
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        gap: 1,
        pb: 1,
        pt: 1.5,
        px: 1,
      }}
    >
      <IconButton
        aria-label={closeLabel}
        edge="start"
        onClick={() => setOpen(false)}
        size="small"
        sx={{ mt: -0.25 }}
      >
        <ChevronLeftIcon />
      </IconButton>
      <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
        <Typography
          component="p"
          sx={{ fontWeight: 600, lineHeight: 1.3, m: 0 }}
        >
          {appTitle}
        </Typography>
        {pageTitle ? (
          <Typography
            color="text.secondary"
            component="p"
            sx={{ m: 0, mt: 0.5 }}
            variant="body2"
          >
            {pageTitle}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
