import type { LayoutProps } from 'react-admin';
import { Layout } from 'react-admin';

import { LegalFooter } from '../legal/LegalLinks';
import { BackofficeConfigProvider } from '../workflows/BackofficeConfigProvider';
import { DocumentTitle } from './AppTitle';
import { BackofficeMenu } from './BackofficeMenu';
import { BackofficeAppBar } from './BackofficeUserMenu';
import { FrameSidebar } from './FrameSidebar';
import { useScrollToTopOnNavigate } from './useScrollToTopOnNavigate';

export function BackofficeLayout(props: LayoutProps) {
  useScrollToTopOnNavigate();

  return (
    <BackofficeConfigProvider>
      <DocumentTitle />
      <Layout
        {...props}
        appBar={BackofficeAppBar}
        menu={BackofficeMenu}
        sidebar={FrameSidebar}
      >
        {props.children}
        <LegalFooter />
      </Layout>
    </BackofficeConfigProvider>
  );
}
