import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../store';
import { logout, selectUser, selectRole, selectIsSuperAdmin } from '../store/slices/authSlice';
import {
  toggleSidebar,
  selectPageTitle,
  selectIsDarkMode,
  toggleDarkMode,
} from '../store/slices/uiSlice';
import { clearTenant } from '../store/slices/tenantSlice';
import { useGetUnreadCountQuery } from '../store/api/notificationsApi';

const GOLD = '#D4A843';
const BLACK = '#1A1A1A';
const WHITE = '#FFFFFF';

export const Header = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const user = useAppSelector(selectUser);
  const role = useAppSelector(selectRole);
  const pageTitle = useAppSelector(selectPageTitle);
  const isDarkMode = useAppSelector(selectIsDarkMode);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);

  const { data: unreadData } = useGetUnreadCountQuery(undefined, {
    skip: isSuperAdmin,
    pollingInterval: 60000,
  });
  const unreadCount = unreadData?.data?.count || 0;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleProfile = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const handleSettings = () => {
    handleMenuClose();
    navigate(isSuperAdmin ? '/superadmin/settings' : '/settings');
  };

  const handleLogout = () => {
    handleMenuClose();
    dispatch(logout());
    dispatch(clearTenant());
    navigate('/login');
  };

  const handleViewAllNotifications = () => {
    handleNotifClose();
    navigate('/notifications');
  };

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: '2px solid rgba(212, 168, 67, 0.15)',
        bgcolor: isDarkMode ? '#141414' : WHITE,
        backdropFilter: 'blur(10px)',
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* Left side */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => dispatch(toggleSidebar())}
            sx={{
              color: BLACK,
              '&:hover': { bgcolor: alpha(GOLD, 0.08) },
            }}
          >
            <MenuIcon />
          </IconButton>

          {!isMobile && pageTitle && (
            <motion.div
              key={pageTitle}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  ml: 1,
                  color: BLACK,
                }}
              >
                {pageTitle}
              </Typography>
            </motion.div>
          )}
        </Box>

        {/* Right side */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Dark mode toggle */}
            <Tooltip title={isDarkMode ? 'Light mode' : 'Dark mode'}>
              <IconButton
                onClick={() => dispatch(toggleDarkMode())}
                sx={{ '&:hover': { bgcolor: alpha(GOLD, 0.08) } }}
              >
                {isDarkMode ? (
                  <LightModeIcon sx={{ color: GOLD }} />
                ) : (
                  <DarkModeIcon />
                )}
              </IconButton>
            </Tooltip>

            {/* Help */}
            <Tooltip title="Help">
              <IconButton sx={{ '&:hover': { bgcolor: alpha(GOLD, 0.08) } }}>
                <HelpIcon />
              </IconButton>
            </Tooltip>

            {/* Notifications */}
            {!isSuperAdmin && (
              <>
                <Tooltip title="Notifications">
                  <IconButton
                    onClick={handleNotifOpen}
                    sx={{ '&:hover': { bgcolor: alpha(GOLD, 0.08) } }}
                  >
                    <Badge
                      badgeContent={unreadCount}
                      sx={{
                        '& .MuiBadge-badge': {
                          bgcolor: GOLD,
                          color: BLACK,
                          fontWeight: 700,
                        },
                      }}
                      max={99}
                    >
                      <NotificationsIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>

                <Menu
                  anchorEl={notifAnchorEl}
                  open={Boolean(notifAnchorEl)}
                  onClose={handleNotifClose}
                  PaperProps={{
                    sx: {
                      width: 320,
                      maxHeight: 400,
                      border: `1px solid ${alpha(GOLD, 0.15)}`,
                    },
                  }}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(GOLD, 0.1)}` }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Notifications
                    </Typography>
                    {unreadCount > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No new notifications
                    </Typography>
                  </Box>

                  <Divider sx={{ borderColor: alpha(GOLD, 0.1) }} />
                  <MenuItem onClick={handleViewAllNotifications}>
                    <Typography
                      variant="body2"
                      sx={{
                        width: '100%',
                        textAlign: 'center',
                        color: GOLD,
                        fontWeight: 600,
                      }}
                    >
                      View All Notifications
                    </Typography>
                  </MenuItem>
                </Menu>
              </>
            )}

            {/* User menu */}
            <Tooltip title="Account">
              <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }}>
                <Avatar
                  src={user?.profilePhotoUrl}
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: GOLD,
                    color: BLACK,
                    fontWeight: 700,
                    border: `2px solid ${alpha(GOLD, 0.3)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: `0 0 12px ${alpha(GOLD, 0.4)}`,
                    },
                  }}
                >
                  {user?.firstName?.charAt(0) || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                sx: {
                  width: 240,
                  mt: 1,
                  border: `1px solid ${alpha(GOLD, 0.15)}`,
                },
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'inline-block',
                    mt: 0.5,
                    px: 1,
                    py: 0.25,
                    bgcolor: GOLD,
                    color: BLACK,
                    borderRadius: 1,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  {role?.replace('_', ' ')}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: alpha(GOLD, 0.1) }} />

              <MenuItem onClick={handleProfile} sx={{ '&:hover': { bgcolor: alpha(GOLD, 0.08) } }}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>My Profile</ListItemText>
              </MenuItem>

              <MenuItem onClick={handleSettings} sx={{ '&:hover': { bgcolor: alpha(GOLD, 0.08) } }}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>

              <Divider sx={{ borderColor: alpha(GOLD, 0.1) }} />

              <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Logout</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </motion.div>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
