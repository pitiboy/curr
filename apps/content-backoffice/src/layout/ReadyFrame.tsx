import { AppLayout } from './AppLayout';
import { Dashboard } from '../dashboard/Dashboard';

/** Shown while the Admin has no Resource children (plan step 1). */
export const ReadyFrame = () => (
  <AppLayout>
    <Dashboard />
  </AppLayout>
);
