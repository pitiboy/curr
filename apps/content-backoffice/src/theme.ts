import type { ThemeOptions } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { defaultDarkTheme, defaultLightTheme } from 'react-admin';

/** Navbar green on https://zoldeletprogram.hu/ (rgb 52, 108, 62). */
const brandGreen = '#346C3E';

/** Lifted brand green so text and icons stay readable on the dark surface. */
const brandGreenOnDark = '#89A98F';

const readableButtons: ThemeOptions = {
  components: {
    MuiAppBar: {
      defaultProps: {
        enableColorOnDark: true,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' },
      },
    },
    RaLogin: {
      styleOverrides: {
        root: {
          backgroundImage:
            'radial-gradient(circle at 50% 14em, #346C3E 0%, #1C3B22 60%, #132917 100%)',
          '& .RaLogin-icon': {
            backgroundColor: brandGreen,
            color: '#ffffff',
          },
        },
      },
    },
  },
};

const brandSecondary = {
  main: brandGreen,
  light: '#5C8964',
  dark: '#244B2B',
  contrastText: '#ffffff',
  // Login avatar reads palette.secondary[500], which augmentColor does not fill.
  500: brandGreen,
};

export const lightTheme = deepmerge(
  defaultLightTheme,
  deepmerge(readableButtons, {
    palette: {
      primary: { main: brandGreen },
      secondary: brandSecondary,
    },
  }),
);

export const darkTheme = deepmerge(
  defaultDarkTheme,
  deepmerge(readableButtons, {
    palette: {
      primary: { main: brandGreenOnDark },
      secondary: brandSecondary,
    },
  }),
);
