import { useState, type ReactElement, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Alert, AppBar, Box, Divider, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemText, Button, Snackbar, Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { dismissHttpError } from './http/interceptors';
import { useAppDispatch, useAppSelector } from './store';
import { logout } from './store/authSlice';
import { NEXT_THEME_CHOICE, useThemeChoice, type ThemeChoice } from './ThemeModeProvider';

const NAV_WIDTH = 220;

const NAV_ITEMS: readonly { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/policies', label: 'Policies' },
  { to: '/quote', label: 'New quote' },
  { to: '/claims/new', label: 'New claim' },
  { to: '/underwriting', label: 'Underwriting' },
];

const DRAWER_SX = {
  width: { md: NAV_WIDTH },
  flexShrink: 0,
  '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' },
};

const USER_SX = { display: { xs: 'none', sm: 'block' }, fontWeight: 600 };

const NAV_LINK_SX = {
  borderRadius: 1,
  color: 'text.secondary',
  '&.active': { bgcolor: 'primary.light', color: 'primary.main' },
};

const MAIN_SX = {
  flex: 1,
  minWidth: 0,
  overflowY: 'auto',
  p: 3,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const THEME_ICON: Record<ThemeChoice, ReactElement> = {
  light: <LightModeIcon fontSize="small" />,
  dark: <DarkModeIcon fontSize="small" />,
  system: <SettingsBrightnessIcon fontSize="small" />,
};

export function AppShell({ children }: { children: ReactNode }): ReactElement {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const httpError = useAppSelector((state) => state.httpError);
  const { choice, setChoice } = useThemeChoice();
  const [navOpen, setNavOpen] = useState(false);
  const isDesktop = useMediaQuery(useTheme().breakpoints.up('md'));

  const navItems = NAV_ITEMS.filter(
    (item) => item.to !== '/underwriting' || user?.role === 'underwriter',
  );

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <IconButton
            edge="start"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          {user && (
            <Typography variant="body2" sx={USER_SX}>
              {user.name} · {user.branch}
            </Typography>
          )}
          <Button size="small" onClick={() => dispatch(logout())}>
            Sign out
          </Button>
          <IconButton
            edge="end"
            aria-label={`Theme: ${choice}. Switch to ${NEXT_THEME_CHOICE[choice]}.`}
            onClick={() => setChoice(NEXT_THEME_CHOICE[choice])}
          >
            {THEME_ICON[choice]}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || navOpen}
        onClose={() => setNavOpen(false)}
        sx={DRAWER_SX}
      >
        <Toolbar variant="dense">
          <Typography variant="h2">AEGIS</Typography>
        </Toolbar>
        <Divider />
        <List sx={{ px: 1, py: 1 }}>
          {navItems.map((item) => (
            <ListItem key={item.to} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                component={NavLink}
                to={item.to}
                end={item.end}
                onClick={() => setNavOpen(false)}
                sx={NAV_LINK_SX}
              >
                <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body1' } }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={MAIN_SX}>
        <Toolbar variant="dense" sx={{ p: 0, minHeight: { xs: 48 } }} />
        {children}
      </Box>

      <Snackbar
        open={httpError.message !== null}
        autoHideDuration={8000}
        onClose={() => dispatch(dismissHttpError())}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => dispatch(dismissHttpError())}>
          {httpError.message} Quote reference {httpError.correlationId} to support.
        </Alert>
      </Snackbar>
    </Box>
  );
}
