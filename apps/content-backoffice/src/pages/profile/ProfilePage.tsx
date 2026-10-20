import { Box, Card, CardContent, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Title, useTranslate } from 'react-admin';

import { fetchProfileFields } from '../../auth/authProvider';
import { ProfilePasswordForm } from './ProfilePasswordForm';

export function ProfilePage() {
  const translate = useTranslate();
  const [name, setName] = useState('…');
  const [email, setEmail] = useState('…');
  const [role, setRole] = useState('…');
  const [provider, setProvider] = useState('local');

  useEffect(() => {
    let active = true;
    fetchProfileFields()
      .then((fields) => {
        if (active) {
          setName(fields.name);
          setEmail(fields.email);
          setProvider(fields.provider);
          setRole(
            fields.roleType
              ? translate(`app.roles.${fields.roleType}`, {
                  _: fields.roleName,
                })
              : fields.roleName,
          );
        }
      })
      .catch(() => {
        if (active) {
          setName('—');
          setEmail('—');
          setRole('—');
        }
      });
    return () => {
      active = false;
    };
  }, [translate]);

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Title title="app.profile" />
      <Card>
        <CardContent>
          <Typography gutterBottom variant="subtitle2">
            {translate('app.profile_name')}
          </Typography>
          <Typography gutterBottom variant="body1">
            {name}
          </Typography>
          <Typography gutterBottom sx={{ mt: 2 }} variant="subtitle2">
            {translate('app.profile_email')}
          </Typography>
          <Typography gutterBottom variant="body1">
            {email}
          </Typography>
          <Typography gutterBottom sx={{ mt: 2 }} variant="subtitle2">
            {translate('app.profile_role')}
          </Typography>
          <Typography variant="body1">{role}</Typography>
        </CardContent>
      </Card>
      {provider === 'local' ? <ProfilePasswordForm /> : null}
    </Box>
  );
}
