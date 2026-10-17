import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslate } from 'react-admin';

import { changePassword } from '../../auth/authProvider';

export function ProfilePasswordForm() {
  const translate = useTranslate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== passwordConfirmation) {
      setError(translate('app.profile_password_mismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({
        currentPassword,
        password,
        passwordConfirmation,
      });
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : translate('app.profile_password_error');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography gutterBottom variant="subtitle2">
          {translate('app.profile_password_heading')}
        </Typography>
        <Box component="form" noValidate onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              autoComplete="current-password"
              fullWidth
              label={translate('app.profile_password_current')}
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <TextField
              autoComplete="new-password"
              fullWidth
              label={translate('app.profile_password_new')}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <TextField
              autoComplete="new-password"
              fullWidth
              label={translate('app.profile_password_confirm')}
              required
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
            />
            {error ? (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            ) : null}
            {success ? (
              <Typography color="success.main" variant="body2">
                {translate('app.profile_password_success')}
              </Typography>
            ) : null}
            <Button disabled={submitting} type="submit" variant="contained">
              {translate('app.profile_password_submit')}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
