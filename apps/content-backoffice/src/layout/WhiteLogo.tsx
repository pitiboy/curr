import Box from '@mui/material/Box';

import { STRAPI_FAVICON_URL } from './AppTitle';

export function WhiteLogo() {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        '& img': {
          width: 32,
          height: 32,
          display: 'block',
          filter: 'brightness(0) invert(1)',
        },
      }}
      aria-label="Logo"
    >
      <Box
        alt=""
        component="img"
        src={STRAPI_FAVICON_URL}
        width={32}
        height={32}
      />
    </Box>
  );
}
