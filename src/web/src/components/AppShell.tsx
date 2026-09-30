'use client';

import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';
import MenuIcon from '@mui/icons-material/Menu';
import ScienceIcon from '@mui/icons-material/Science';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Playground', icon: <ScienceIcon /> },
  { href: '/samples', label: 'Samples', icon: <AutoGraphIcon /> },
  { href: '/evaluate', label: 'Evaluate', icon: <TuneIcon /> },
  { href: '/history', label: 'History', icon: <HistoryIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  { href: '/about', label: 'About', icon: <InfoIcon /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  const active = useMemo(() => navItems.find((item) => (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)))?.href ?? '/', [pathname]);
  const { mode, setMode } = useColorScheme();
  const colorMode = mode === 'dark' ? 'dark' : 'light';

  const nav = (
    <List aria-label="Primary navigation" sx={{ width: 260 }}>
      {navItems.map((item) => (
        <ListItemButton key={item.href} component={Link} href={item.href} selected={active === item.href} onClick={() => setOpen(false)}>
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', backdropFilter: 'blur(14px)' }}>
        <Toolbar>
          <IconButton edge="start" aria-label="Open navigation" onClick={() => setOpen(true)} sx={{ mr: 1, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <AutoGraphIcon color="primary" sx={{ mr: 1 }} aria-hidden />
          <Typography variant="h6" component="div" sx={{ fontWeight: 800, mr: 3, whiteSpace: 'nowrap' }}>
            Jev Evaluation Studio
          </Typography>
          <Tabs value={active} aria-label="Main sections" sx={{ display: { xs: 'none', md: 'block' }, flex: 1 }}>
            {navItems.map((item) => (
              <Tab key={item.href} label={item.label} value={item.href} component={Link} href={item.href} />
            ))}
          </Tabs>
          <Tooltip title={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}>
            <IconButton aria-label="Toggle dark and light mode" onClick={() => setMode(colorMode === 'dark' ? 'light' : 'dark')}>
              {colorMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer open={open} onClose={() => setOpen(false)}>{nav}</Drawer>
      <Box component="main" sx={{ maxWidth: 1480, mx: 'auto', p: { xs: 2, md: 4 } }}>{children}</Box>
    </Box>
  );
}
