import type { LayoutProps } from 'react-admin';
import { Layout } from 'react-admin';

import { BackofficeMenu } from './BackofficeMenu';
import { BackofficeAppBar } from './BackofficeUserMenu';
import { FrameSidebar } from './FrameSidebar';

export function BackofficeLayout(props: LayoutProps) {
  return (
    <Layout
      {...props}
      appBar={BackofficeAppBar}
      menu={BackofficeMenu}
      sidebar={FrameSidebar}
    />
  );
}
