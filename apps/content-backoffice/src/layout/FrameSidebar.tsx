import { Box, Divider } from '@mui/material';
import type { SidebarProps } from 'react-admin';
import { Sidebar, useSidebarState } from 'react-admin';

import { GlobalTransactionFiltersPanel } from '../filters/GlobalTransactionFiltersPanel';
import { SidebarMobileHeader } from './SidebarMobileHeader';

export function FrameSidebar(props: SidebarProps) {
  const { children, ...rest } = props;
  const [open] = useSidebarState();

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
      {open ? (
        <>
          <Divider />
          <Box sx={{ overflowY: 'auto' }}>
            <GlobalTransactionFiltersPanel />
          </Box>
        </>
      ) : null}
    </Sidebar>
  );
}
