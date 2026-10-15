import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { type FormEvent, useEffect, useState } from 'react';
import { Title, useNotify, useTranslate } from 'react-admin';

import { fetchProfileFields, httpClient } from '../../auth/authProvider';
import { changePassword } from '../../auth/changePassword';
import { isLocalProvider } from '../../auth/session';
import { STRAPI_URL } from '../../config';

type ProfileFields = {
  name: string;
  email: string;
  provider: string | null;
};

export function ProfilePage() {
  const translate = useTranslate();
  const notify = useNotify();
  const [profile, setProfile] = useState<ProfileFields | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchProfileFields()
      .then((fields) => {
        if (active) setProfile(fields);
      })
      .catch(() => {
        if (active) {
          setProfile({ name: '—', email: '—', provider: null });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      notify('app.profile_password_mismatch', { type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(httpClient, STRAPI_URL, {
        currentPassword,
        password,
        passwordConfirmation,
      });
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      notify('app.profile_password_changed', { type: 'success' });
    } catch {
      notify('app.profile_password_error', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Title title="app.profile" />
      <Card>
        <CardContent>
          <Typography gutterBottom variant="subtitle2">
            {translate('app.profile_name')}
          </Typography>
          <Typography gutterBottom variant="body1">
            {profile?.name ?? '…'}
          </Typography>
          <Typography gutterBottom sx={{ mt: 2 }} variant="subtitle2">
            {translate('app.profile_email')}
          </Typography>
          <Typography variant="body1">{profile?.email ?? '…'}</Typography>
          {profile && isLocalProvider(profile.provider) ? (
            <Box component="form" onSubmit={onSubmit} sx={{ mt: 3 }}>
              <Typography gutterBottom variant="subtitle2">
                {translate('app.profile_password')}
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  autoComplete="current-password"
                  fullWidth
                  label={translate('app.profile_current_password')}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
                <TextField
                  autoComplete="new-password"
                  fullWidth
                  label={translate('app.profile_new_password')}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <TextField
                  autoComplete="new-password"
                  fullWidth
                  label={translate('app.profile_confirm_password')}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                  type="password"
                  value={passwordConfirmation}
                />
                <Button
                  disabled={saving}
                  type="submit"
                  variant="contained"
                >
                  {translate('app.profile_password_save')}
                </Button>
              </Stack>
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
