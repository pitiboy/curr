import FilterListIcon from '@mui/icons-material/FilterList';
import { Box, Divider, IconButton, Tooltip } from '@mui/material';
import type { SidebarProps } from 'react-admin';
import { Sidebar, useSidebarState, useTranslate } from 'react-admin';

import { GlobalTransactionFiltersPanel } from '../filters/GlobalTransactionFiltersPanel';
import { SidebarMobileHeader } from './SidebarMobileHeader';

export function FrameSidebar(props: SidebarProps) {
  const { children, ...rest } = props;
  const [open, setOpen] = useSidebarState();
  const translate = useTranslate();
  const filtersLabel = translate('app.filters.panel_title');

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
        '& .RaSidebar-fixed': {
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        },
        // Closed rail: keep menu icons centered in the narrow strip.
        '&.RaSidebar-closed .RaMenu-closed .RaMenuItemLink-root': {
          justifyContent: 'center',
          px: 0,
        },
        '&.RaSidebar-closed .RaMenu-closed .RaMenuItemLink-icon': {
          minWidth: 0,
          mr: 0,
          justifyContent: 'center',
        },
      }}
    >
      <SidebarMobileHeader />
      <Box
        sx={{
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
          // Mobile: one scrollbar for menu + filters when content exceeds height.
          // Desktop: clip here so only the filter pane scrolls.
          overflowX: 'hidden',
          overflowY: { xs: 'auto', sm: 'hidden' },
          width: '100%',
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            minWidth: 0,
            overflow: 'visible',
            width: '100%',
          }}
        >
          {children}
        </Box>
        {open ? (
          <>
            <Divider sx={{ flexShrink: 0 }} />
            <Box
              sx={{
                flex: { xs: '0 0 auto', sm: '1 1 auto' },
                minHeight: { xs: 'auto', sm: 0 },
                minWidth: 0,
                overflowX: 'hidden',
                overflowY: { xs: 'visible', sm: 'auto' },
                width: '100%',
              }}
            >
              <GlobalTransactionFiltersPanel />
            </Box>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexShrink: 0,
              justifyContent: 'center',
              py: 0.5,
              width: '100%',
            }}
          >
            <Tooltip placement="right" title={filtersLabel}>
              <IconButton
                aria-label={filtersLabel}
                color="inherit"
                onClick={() => setOpen(true)}
                size="small"
              >
                <FilterListIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Sidebar>
  );
}
