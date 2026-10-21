import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';

import { useAppTitle } from './AppTitle';
import { useRaPageTitle } from './useRaPageTitle';

/** Shown at the top of the drawer menu on small screens (titles removed from the app bar). */
export function SidebarMobileHeader() {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const appTitle = useAppTitle();
  const pageTitle = useRaPageTitle();

  if (!isMobile) {
    return null;
  }

  return (
    <Box
      sx={{
        px: 2,
        pt: 1.5,
        pb: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography component="p" sx={{ fontWeight: 600, lineHeight: 1.3, m: 0 }}>
        {appTitle}
      </Typography>
      {pageTitle ? (
        <Typography color="text.secondary" component="p" sx={{ m: 0, mt: 0.5 }} variant="body2">
          {pageTitle}
        </Typography>
      ) : null}
    </Box>
  );
}
