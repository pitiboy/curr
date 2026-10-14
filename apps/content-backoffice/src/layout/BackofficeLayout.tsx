import type { LayoutProps } from 'react-admin';
import { Layout } from 'react-admin';

import { BackofficeMenu } from './BackofficeMenu';
import { FrameSidebar } from './FrameSidebar';

export function BackofficeLayout(props: LayoutProps) {
  return <Layout {...props} menu={BackofficeMenu} sidebar={FrameSidebar} />;
}
