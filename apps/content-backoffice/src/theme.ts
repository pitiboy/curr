import type { PaletteMode, SxProps, Theme, ThemeOptions } from '@mui/material/styles';
import type { SxProps as UntypedSx, SystemStyleObject } from '@mui/system';
import { deepmerge } from '@mui/utils';
import { defaultDarkTheme, defaultLightTheme } from 'react-admin';

/** Navbar green on https://zoldeletprogram.hu/ (rgb 52, 108, 62). */
const brandGreen = '#346C3E';

/** Lifted brand green so text and icons stay readable on the dark surface. */
const brandGreenOnDark = '#89A98F';

/** Faint sage and sand so consecutive rows stay easy to scan. */
const band = {
  light: ['#FAFDFC', '#FFFDFB'],
  dark: ['rgba(137, 169, 143, 0.18)', 'rgba(212, 190, 150, 0.16)'],
} as const;

export function bandColor(mode: PaletteMode, index: number): string {
  return band[mode][Math.abs(index) % 2];
}

function childBands(theme: Theme) {
  return {
    '& > :nth-of-type(odd)': { backgroundColor: bandColor(theme.palette.mode, 0) },
    '& > :nth-of-type(even)': { backgroundColor: bandColor(theme.palette.mode, 1) },
  };
}

/** Direct children alternate sage and sand. Spread into the parent's styles. */
export function withBands(styles: SystemStyleObject<Theme> = {}) {
  return (theme: Theme) => ({
    ...styles,
    ...childBands(theme),
  });
}

/** One row, when the parent cannot own the stripe. */
export function bandedRow(_record: unknown, index: number): UntypedSx {
  return ((theme: Theme) => ({
    backgroundColor: bandColor(theme.palette.mode, index),
  })) as UntypedSx;
}

/** SimpleForm fields sit in a stack; that stack owns the stripe. */
export const bandedForm: SxProps<Theme> = (theme) => ({
  '& > .MuiStack-root': {
    gap: 1,
    width: '100%',
    '& > *': {
      borderRadius: 1,
      boxSizing: 'border-box',
      px: 1.5,
      py: 1,
      width: '100%',
    },
    ...childBands(theme),
  },
});

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
