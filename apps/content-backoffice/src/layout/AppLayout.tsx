import type { ReactNode } from 'react';
import { Layout } from 'react-admin';
import { EmptyMenu } from './EmptyMenu';

export const AppLayout = ({ children }: { children: ReactNode }) => (
  <Layout menu={EmptyMenu}>{children}</Layout>
);
