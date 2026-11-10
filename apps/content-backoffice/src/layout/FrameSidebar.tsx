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
          overflow: 'hidden',
        },
        // Keep nav pinned: overflow must stay hidden so only the filter pane scrolls.
        '& .RaSidebar-fixed': {
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        },
      }}
    >
      <SidebarMobileHeader />
      <Box sx={{ flexShrink: 0, minWidth: 0, width: '100%' }}>{children}</Box>
      {open ? (
        <>
          <Divider sx={{ flexShrink: 0 }} />
          <Box
            sx={{
              flex: '1 1 auto',
              minHeight: 0,
              minWidth: 0,
              overflowX: 'hidden',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            <GlobalTransactionFiltersPanel />
          </Box>
        </>
      ) : null}
    </Sidebar>
  );
}
