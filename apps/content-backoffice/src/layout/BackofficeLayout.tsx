import type { LayoutProps } from 'react-admin';
import { Layout } from 'react-admin';

import { BackofficeConfigProvider } from '../workflows/BackofficeConfigProvider';
import { DocumentTitle } from './AppTitle';
import { BackofficeMenu } from './BackofficeMenu';
import { BackofficeAppBar } from './BackofficeUserMenu';
import { FrameSidebar } from './FrameSidebar';

export function BackofficeLayout(props: LayoutProps) {
  return (
    <BackofficeConfigProvider>
      <DocumentTitle />
      <Layout
        {...props}
        appBar={BackofficeAppBar}
        menu={BackofficeMenu}
        sidebar={FrameSidebar}
      />
    </BackofficeConfigProvider>
  );
}
