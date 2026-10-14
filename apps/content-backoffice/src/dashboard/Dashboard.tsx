import { Card, CardContent, Typography } from '@mui/material';
import { Title, useTranslate } from 'react-admin';

export const Dashboard = () => {
  const translate = useTranslate();

  return (
    <Card>
      <Title title="ra.page.dashboard" />
      <CardContent>
        <Typography variant="h5" component="h1" gutterBottom>
          {translate('ra.page.dashboard')}
        </Typography>
        <Typography variant="body1">{translate('app.dashboard.body')}</Typography>
      </CardContent>
    </Card>
  );
};
