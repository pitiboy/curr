import GoogleIcon from '@mui/icons-material/Google';
import { Box, Button } from '@mui/material';
import { LoginWithEmail, useTranslate } from 'react-admin';

export function LoginPage() {
  const translate = useTranslate();

  return (
    <Box>
      <LoginWithEmail />
      <Box sx={{ maxWidth: 360, mx: 'auto', px: 2, pb: 3, width: '100%' }}>
        <Button
          disabled
          fullWidth
          startIcon={<GoogleIcon />}
          variant="outlined"
        >
          {translate('app.login_google')}
        </Button>
      </Box>
    </Box>
  );
}
