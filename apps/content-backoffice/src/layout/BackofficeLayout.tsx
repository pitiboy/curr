import type { LayoutProps } from 'react-admin';
import { Layout } from 'react-admin';

import { StaticFooter } from '../static/StaticLinks';
import { DocumentTitle } from './AppTitle';
import { BackofficeMenu } from './BackofficeMenu';
import { BackofficeAppBar } from './BackofficeUserMenu';
import { FrameSidebar } from './FrameSidebar';
import { useScrollToTopOnNavigate } from './useScrollToTopOnNavigate';

export function BackofficeLayout(props: LayoutProps) {
  useScrollToTopOnNavigate();

  return (
    <>
      <DocumentTitle />
      <Layout
        {...props}
        appBar={BackofficeAppBar}
        menu={BackofficeMenu}
        sidebar={FrameSidebar}
      >
        {props.children}
        <StaticFooter />
      </Layout>
    </>
  );
}
