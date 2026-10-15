import type { SidebarProps } from 'react-admin';
import { Sidebar } from 'react-admin';

export function FrameSidebar(props: SidebarProps) {
  return (
    <Sidebar
      {...props}
      sx={{
        '& .MuiPaper-root': {
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    />
  );
}
