import GoogleIcon from '@mui/icons-material/Google';
import { Box, Button } from '@mui/material';
import {
  Login,
  LoginForm,
  PasswordInput,
  required,
  TextInput,
  useTranslate,
} from 'react-admin';

export function LoginPage() {
  const translate = useTranslate();

  return (
    <Login>
      <LoginForm>
        <TextInput
          autoComplete="email"
          autoFocus
          label={translate('ra.auth.email', { _: 'Email' })}
          source="email"
          type="email"
          validate={required()}
        />
        <PasswordInput
          autoComplete="current-password"
          label={translate('ra.auth.password', { _: 'Password' })}
          source="password"
          validate={required()}
        />
      </LoginForm>
      <Box sx={{ boxSizing: 'border-box', pb: 2, px: 2, width: 300 }}>
        <Button
          disabled
          fullWidth
          startIcon={<GoogleIcon />}
          variant="outlined"
        >
          {translate('app.login_google')}
        </Button>
      </Box>
    </Login>
  );
}
