import type { SidebarProps } from 'react-admin';
import { Sidebar } from 'react-admin';

import { SidebarMobileHeader } from './SidebarMobileHeader';

export function FrameSidebar(props: SidebarProps) {
  const { children, ...rest } = props;

  return (
    <Sidebar
      {...rest}
      sx={{
        '& .MuiPaper-root': {
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <SidebarMobileHeader />
      {children}
    </Sidebar>
  );
}
