import { useState, type ReactElement, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { AS_OF } from '../data';
import { formatDate } from '../format';
import { preloadPath } from '../routes/lazyRoutes';
import { useAuth } from '../store/useAuth';
import { useThemeChoice, type ThemeChoice } from '../theme/ThemeModeProvider';
import type { Role } from '../types';

/**
 * Matches `--nav-width` in `global.css`. The two are not wired together and
 * cannot be — `theme.spacing` and a CSS custom property are resolved by
 * different engines at different times — but the CSS Modules routes still size
 * their own content against the token, so the numbers have to agree.
 */
const NAV_WIDTH = 224;

const NAV_ITEMS: readonly { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/policies', label: 'Policies' },
  { to: '/quote', label: 'New quote' },
  { to: '/claims/new', label: 'New claim' },
  { to: '/underwriting', label: 'Underwriting' },
];

const ROLE_LABEL: Record<Role, string> = {
  agent: 'Agent',
  underwriter: 'Underwriter',
};

const THEME_LABEL: Record<ThemeChoice, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/** Light → Dark → System → Light. See the header for why 'system' stays in. */
const NEXT_CHOICE: Record<ThemeChoice, ThemeChoice> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

function themeIcon(choice: ThemeChoice): ReactElement {
  if (choice === 'light') return <LightModeIcon fontSize="small" />;
  if (choice === 'dark') return <DarkModeIcon fontSize="small" />;
  return <SettingsBrightnessIcon fontSize="small" />;
}

export function AppShell({ children }: { children: ReactNode }): ReactElement {
  const { user, role, status, error, switchRole } = useAuth();
  const { choice, setChoice } = useThemeChoice();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const nextChoice = NEXT_CHOICE[choice];

  /*
   * Rendered into both Drawers. Building it once is not a micro-optimisation:
   * two copies of this list is how the mobile nav and the desktop nav drift
   * apart, and the drift is invisible until someone opens the app on a phone.
   */
  const navContent = (
    <>
      {/* Spacer — see the header. Aligns the first nav item below the AppBar. */}
      <Toolbar variant="dense">
        <Typography variant="h2" component="span" sx={{ letterSpacing: '0.02em' }}>
          AEGIS
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 1.5 }}>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.to} disablePadding sx={{ mb: 0.25 }}>
            {/*
              `component={NavLink}` rather than a `<NavLink>` wrapped around a
              button: the router link has to BE the focusable element, or the
              ripple, the hover ground and the focus ring all belong to a
              different box than the one the keyboard lands on.

              React Router appends its own `active` class to whatever className
              it is handed, which is what `&.active` below hooks — so the
              active styling is still NavLink's, expressed through the theme
              rather than through a CSS Module.
            */}
            <ListItemButton
              component={NavLink}
              to={item.to}
              end={item.end}
              onMouseEnter={() => preloadPath(item.to)}
              onFocus={() => preloadPath(item.to)}
              onClick={() => setMobileNavOpen(false)}
              sx={{
                borderRadius: 1,
                color: 'text.secondary',
                '&.active': {
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                  fontWeight: 600,
                },
              }}
            >
              <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body1' } }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        /*
         * `+ 1` over the drawer, not a literal — the two zIndex values are
         * defined together in the theme, and a hard-coded 1300 here would
         * silently stop being "just above the drawer" the moment either moved.
         */
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <IconButton
            edge="start"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>

          <Typography
            variant="h2"
            component="span"
            sx={{ display: { xs: 'inline', md: 'none' }, letterSpacing: '0.02em' }}
          >
            AEGIS
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/*
            Dropped first as the viewport narrows, in order of how recoverable
            the information is: the valuation date is also printed on the pages
            that depend on it, the branch is a page away, the two controls are
            not reachable from anywhere else at all and so never drop.
          */}
          <Typography
            variant="body2"
            sx={{ display: { xs: 'none', lg: 'block' }, color: 'text.secondary' }}
          >
            Valuation date {formatDate(AS_OF)}
          </Typography>

          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 600 }}>
            {user.name} · {user.branch}
          </Typography>

          {/*
            The three lifecycle states of `loginThunk` land here, and this is
            the only place in the app they are visible. Switching role
            re-authenticates (the backend stamps the role into the token it
            issues), so `status` goes 'loading' for the length of that round
            trip and the control locks itself: without the lock a second
            switch fires while the first is still in flight, both resolve, and
            which token the store keeps is decided by whichever `fulfilled`
            lands last — an underwriter left holding an agent's token, with
            nothing on screen to say so.
          */}
          <TextField
            select
            size="small"
            label="Viewing as"
            value={role}
            disabled={status === 'loading'}
            error={status === 'error'}
            helperText={status === 'error' ? error : undefined}
            onChange={(event) => switchRole(event.target.value as Role)}
            sx={{ minWidth: 132 }}
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((value) => (
              <MenuItem key={value} value={value}>
                {ROLE_LABEL[value]}
              </MenuItem>
            ))}
          </TextField>

          <Tooltip title={`Theme: ${THEME_LABEL[choice]}`}>
            <IconButton
              edge="end"
              onClick={() => setChoice(nextChoice)}
              aria-label={`Theme: ${THEME_LABEL[choice]}. Switch to ${THEME_LABEL[nextChoice]}.`}
            >
              {themeIcon(choice)}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: NAV_WIDTH }, flexShrink: { md: 0 } }}>
        {/*
          Two Drawers, one nav. The temporary one is not rendered at all while
          closed, so on desktop there is exactly one copy of the links in the
          DOM — which is what keeps `preloadPath` firing once per hover and
          keeps the accessibility tree free of a duplicate nav landmark.
        */}
        <Drawer
          variant="temporary"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {navContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {navContent}
        </Drawer>
      </Box>

      {/*
        The content region is deliberately unstyled beyond spacing and the
        scroll container. Half the routes below it are CSS Modules surfaces and
        stay that way — the chrome is MUI, the content is whatever the route
        is, and that line is the boundary `CLAUDE.md` asks not to blur.
      */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 3,
        }}
      >
        <Toolbar variant="dense" sx={{ p: 0, minHeight: { xs: 48 } }} />
        {children}
      </Box>
    </Box>
  );
}
