import Box from '@mui/material/Box';

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
        '& svg': {
          width: 32,
          height: 32,
          display: 'block',
          filter: 'brightness(0) invert(1)',
        },
      }}
      aria-label="Logo"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <image
          href={`${import.meta.env.BASE_URL}favicon.svg`}
          width="32"
          height="32"
        />
      </svg>
    </Box>
  );
}
