import { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  Collapse,
  alpha,
  useTheme,
  useMediaQuery,
  Select,
  MenuItem as MuiMenuItem,
  FormControl,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  Class as ClassIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamIcon,
  Quiz as McqIcon,
  Payment as FeeIcon,
  Event as EventIcon,
  Notifications as NotificationIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  CalendarMonth as TimetableIcon,
  Description as ReportIcon,
  Business as TenantIcon,
  ToggleOn as FeatureIcon,
  MenuBook as ContentIcon,
  Message as MessageIcon,
  FamilyRestroom as ParentIcon,
  Note as NoteIcon,
  CalendarToday as AcademicYearIcon,
  DateRange as DateRangeIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../store';
import { selectRole, selectUser, selectFeatureFlags, selectIsSuperAdmin } from '../store/slices/authSlice';
import { selectSidebarOpen, setSidebarOpen, selectSelectedAcademicYearId, setSelectedAcademicYear } from '../store/slices/uiSlice';
import { selectSchoolInfo } from '../store/slices/tenantSlice';
import { useGetAcademicYearsQuery } from '../store/api/classesApi';
import { UserRole, FeatureKey } from '../types';

const DRAWER_WIDTH = 280;
const GOLD = '#D4A843';
const GOLD_LIGHT = '#E8C97A';

interface MenuItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  feature?: FeatureKey;
  children?: MenuItem[];
}

// Menu configuration
const getMenuItems = (role: UserRole | null, isSuperAdmin: boolean): MenuItem[] => {
  if (isSuperAdmin) {
    return [
      { title: 'Dashboard', path: '/superadmin/dashboard', icon: <DashboardIcon /> },
      { title: 'Tenants', path: '/superadmin/tenants', icon: <TenantIcon /> },
      { title: 'Feature Flags', path: '/superadmin/features', icon: <FeatureIcon /> },
      { title: 'Audit Logs', path: '/superadmin/audit-logs', icon: <ReportIcon /> },
      { title: 'Settings', path: '/superadmin/settings', icon: <SettingsIcon /> },
    ];
  }

  const items: MenuItem[] = [
    { title: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  ];

  if (role === UserRole.SCHOOL_ADMIN || role === UserRole.PRINCIPAL) {
    items.push(
      { title: 'Users', path: '/users', icon: <PeopleIcon />, roles: [UserRole.SCHOOL_ADMIN] },
      { title: 'Students', path: '/students', icon: <SchoolIcon />, roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      { title: 'Teachers', path: '/teachers', icon: <PersonIcon />, roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      { title: 'Classes', path: '/classes', icon: <ClassIcon />, roles: [UserRole.SCHOOL_ADMIN] },
      { title: 'Academic Years', path: '/academic-years', icon: <DateRangeIcon />, roles: [UserRole.SCHOOL_ADMIN] },
      { title: 'Attendance', path: '/attendance', icon: <AttendanceIcon />, feature: 'attendance' },
      { title: 'Timetable', path: '/timetable', icon: <TimetableIcon />, feature: 'timetable' },
      { title: 'Exams', path: '/exams', icon: <ExamIcon />, feature: 'exams' },
      { title: 'MCQ Exams', path: '/mcq', icon: <McqIcon />, feature: 'mcq' },
      { title: 'Fees', path: '/fees', icon: <FeeIcon />, feature: 'fee', roles: [UserRole.SCHOOL_ADMIN] },
      { title: 'Events', path: '/events', icon: <EventIcon />, feature: 'events' },
      { title: 'Notifications', path: '/notifications', icon: <NotificationIcon />, feature: 'notifications' },
      { title: 'WhatsApp', path: '/whatsapp', icon: <WhatsAppIcon />, feature: 'whatsapp' as FeatureKey },
      { title: 'Reports', path: '/reports', icon: <ReportIcon />, feature: 'analytics', roles: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] },
      { title: 'Settings', path: '/settings', icon: <SettingsIcon />, roles: [UserRole.SCHOOL_ADMIN] }
    );
  }

  if (role === UserRole.TEACHER) {
    items.push(
      { title: 'My Classes', path: '/my-classes', icon: <ClassIcon /> },
      { title: 'My Students', path: '/my-students', icon: <SchoolIcon /> },
      { title: 'Attendance', path: '/attendance', icon: <AttendanceIcon />, feature: 'attendance' },
      { title: 'Timetable', path: '/timetable', icon: <TimetableIcon />, feature: 'timetable' },
      { title: 'Exams', path: '/exams', icon: <ExamIcon />, feature: 'exams' },
      { title: 'MCQ Exams', path: '/mcq', icon: <McqIcon />, feature: 'mcq' },
      { title: 'Study Materials', path: '/study-materials', icon: <ContentIcon />, feature: 'content' },
      { title: 'Mentoring Notes', path: '/mentoring', icon: <NoteIcon /> },
      { title: 'Messages', path: '/messages', icon: <MessageIcon />, feature: 'messaging' },
      { title: 'WhatsApp', path: '/whatsapp', icon: <WhatsAppIcon />, feature: 'whatsapp' as FeatureKey },
      { title: 'Notifications', path: '/notifications', icon: <NotificationIcon />, feature: 'notifications' }
    );
  }

  if (role === UserRole.STUDENT) {
    items.push(
      { title: 'My Timetable', path: '/timetable', icon: <TimetableIcon />, feature: 'timetable' },
      { title: 'My Attendance', path: '/my-attendance', icon: <AttendanceIcon />, feature: 'attendance' },
      { title: 'My Marks', path: '/my-marks', icon: <ExamIcon />, feature: 'exams' },
      { title: 'MCQ Exams', path: '/mcq/available', icon: <McqIcon />, feature: 'mcq' },
      { title: 'Study Materials', path: '/study-materials', icon: <ContentIcon />, feature: 'content' },
      { title: 'Events', path: '/events', icon: <EventIcon />, feature: 'events' },
      { title: 'Notifications', path: '/notifications', icon: <NotificationIcon />, feature: 'notifications' },
      { title: 'Messages', path: '/messages', icon: <MessageIcon />, feature: 'messaging' }
    );
  }

  if (role === UserRole.PARENT) {
    items.push(
      { title: 'My Children', path: '/children', icon: <ParentIcon /> },
      { title: 'Attendance', path: '/child-attendance', icon: <AttendanceIcon />, feature: 'attendance' },
      { title: 'Marks', path: '/child-marks', icon: <ExamIcon />, feature: 'exams' },
      { title: 'Fee Status', path: '/fee-status', icon: <FeeIcon />, feature: 'fee' },
      { title: 'Events', path: '/events', icon: <EventIcon />, feature: 'events' },
      { title: 'Notifications', path: '/notifications', icon: <NotificationIcon />, feature: 'notifications' },
      { title: 'Messages', path: '/messages', icon: <MessageIcon />, feature: 'messaging' }
    );
  }

  return items;
};

export const Sidebar = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const sidebarOpen = useAppSelector(selectSidebarOpen);
  const role = useAppSelector(selectRole);
  const user = useAppSelector(selectUser);
  const featureFlags = useAppSelector(selectFeatureFlags);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const schoolInfo = useAppSelector(selectSchoolInfo);
  const selectedAcademicYearId = useAppSelector(selectSelectedAcademicYearId);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Fetch academic years (skip for super admin)
  const { data: academicYearsData, isLoading: isLoadingAY } = useGetAcademicYearsQuery(undefined, {
    skip: isSuperAdmin,
  });

  const academicYears = academicYearsData?.data || [];

  // Auto-select current academic year on first load
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const current = academicYears.find((ay) => ay.isCurrent);
      if (current) {
        dispatch(setSelectedAcademicYear(current.academicYearId));
      } else {
        dispatch(setSelectedAcademicYear(academicYears[0].academicYearId));
      }
    }
  }, [academicYears, selectedAcademicYearId, dispatch]);

  const menuItems = useMemo(
    () => getMenuItems(role, isSuperAdmin),
    [role, isSuperAdmin]
  );

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      dispatch(setSidebarOpen(false));
    }
  };

  const isItemVisible = (item: MenuItem): boolean => {
    if (item.roles && role && !item.roles.includes(role)) return false;
    if (item.feature && !isSuperAdmin && !featureFlags[item.feature]) return false;
    return true;
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: MenuItem) =>
    item.children?.some((child) => location.pathname === child.path);

  const handleAcademicYearChange = (yearId: string) => {
    dispatch(setSelectedAcademicYear(yearId));
  };

  const selectedYear = academicYears.find((ay) => ay.academicYearId === selectedAcademicYearId);

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0D0D0D' }}>
      {/* Logo/School Header */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: `1px solid ${alpha(GOLD, 0.15)}`,
          background: `linear-gradient(180deg, ${alpha(GOLD, 0.08)} 0%, transparent 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={isSuperAdmin ? undefined : schoolInfo?.logoUrl}
            sx={{
              width: 42,
              height: 42,
              bgcolor: GOLD,
              color: '#0D0D0D',
              fontWeight: 700,
              fontSize: '1.1rem',
              boxShadow: `0 0 12px ${alpha(GOLD, 0.3)}`,
            }}
          >
            {isSuperAdmin ? 'SA' : schoolInfo?.schoolName?.charAt(0) || 'S'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              noWrap
              sx={{
                lineHeight: 1.2,
                color: '#FFFFFF',
                letterSpacing: '0.02em',
              }}
            >
              {isSuperAdmin ? 'Super Admin' : schoolInfo?.schoolName || 'School'}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{ color: alpha(GOLD, 0.8), letterSpacing: '0.05em' }}
            >
              {isSuperAdmin ? 'SaaS Management' : 'Management System'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Academic Year Selector - Only for non-super-admin */}
      {!isSuperAdmin && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${alpha(GOLD, 0.1)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AcademicYearIcon sx={{ fontSize: 16, color: alpha(GOLD, 0.7) }} />
            <Typography
              variant="caption"
              sx={{
                color: alpha('#FFFFFF', 0.5),
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontSize: '0.65rem',
              }}
            >
              Academic Year
            </Typography>
            {selectedYear?.isCurrent && (
              <Chip
                label="Current"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: alpha(GOLD, 0.15),
                  color: GOLD,
                  ml: 'auto',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )}
          </Box>

          {isLoadingAY ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <CircularProgress size={16} sx={{ color: GOLD }} />
              <Typography variant="caption" sx={{ color: alpha('#FFFFFF', 0.4) }}>
                Loading...
              </Typography>
            </Box>
          ) : (
            <FormControl fullWidth size="small">
              <Select
                value={selectedAcademicYearId || ''}
                onChange={(e) => handleAcademicYearChange(e.target.value as string)}
                displayEmpty
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#1A1A1A',
                      border: `1px solid ${alpha(GOLD, 0.2)}`,
                      '& .MuiMenuItem-root': {
                        color: '#FFFFFF',
                        fontSize: '0.85rem',
                        '&:hover': {
                          bgcolor: alpha(GOLD, 0.1),
                        },
                        '&.Mui-selected': {
                          bgcolor: alpha(GOLD, 0.15),
                          color: GOLD,
                          fontWeight: 600,
                          '&:hover': {
                            bgcolor: alpha(GOLD, 0.2),
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  bgcolor: alpha('#FFFFFF', 0.04),
                  borderRadius: 2,
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(GOLD, 0.2),
                    borderWidth: 1,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(GOLD, 0.4),
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: GOLD,
                    borderWidth: 2,
                  },
                  '& .MuiSelect-icon': {
                    color: alpha(GOLD, 0.6),
                  },
                  '& .MuiSelect-select': {
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  },
                }}
              >
                {academicYears.map((ay) => (
                  <MuiMenuItem key={ay.academicYearId} value={ay.academicYearId}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: ay.isCurrent ? 700 : 400 }}>
                        {ay.label}
                      </Typography>
                      {ay.isCurrent && (
                        <Chip
                          label="Current"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            bgcolor: alpha(GOLD, 0.15),
                            color: GOLD,
                            ml: 'auto',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                      {ay.status === 'ARCHIVED' && (
                        <Chip
                          label="Archived"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 600,
                            bgcolor: alpha('#FFFFFF', 0.08),
                            color: alpha('#FFFFFF', 0.5),
                            ml: 'auto',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                    </Box>
                  </MuiMenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1.5 }}>
        <List sx={{ px: 1.5 }}>
          {menuItems.map((item, index) => {
            if (!isItemVisible(item)) return null;

            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.title);
            const active = isActive(item.path) || isParentActive(item);

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() =>
                      hasChildren
                        ? toggleExpand(item.title)
                        : handleNavigate(item.path)
                    }
                    sx={{
                      borderRadius: 2,
                      bgcolor: active
                        ? alpha(GOLD, 0.15)
                        : 'transparent',
                      color: active ? GOLD : 'rgba(255,255,255,0.7)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': active ? {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '20%',
                        bottom: '20%',
                        width: 3,
                        borderRadius: 4,
                        bgcolor: GOLD,
                      } : {},
                      '&:hover': {
                        bgcolor: active
                          ? alpha(GOLD, 0.22)
                          : alpha('#FFFFFF', 0.06),
                        color: active ? GOLD_LIGHT : '#FFFFFF',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: active ? GOLD : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: active ? 600 : 400,
                      }}
                    />
                    {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
                  </ListItemButton>
                </ListItem>

                {hasChildren && (
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <List disablePadding sx={{ pl: 2 }}>
                      {item.children?.map((child) => {
                        if (!isItemVisible(child)) return null;
                        const childActive = isActive(child.path);

                        return (
                          <ListItem key={child.title} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                              onClick={() => handleNavigate(child.path)}
                              sx={{
                                borderRadius: 2,
                                bgcolor: childActive
                                  ? alpha(GOLD, 0.15)
                                  : 'transparent',
                                color: childActive ? GOLD : 'rgba(255,255,255,0.7)',
                                '&:hover': {
                                  bgcolor: alpha('#FFFFFF', 0.06),
                                },
                              }}
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 40,
                                  color: childActive ? GOLD : alpha('#FFFFFF', 0.4),
                                }}
                              >
                                {child.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={child.title}
                                primaryTypographyProps={{
                                  fontSize: '0.8125rem',
                                  fontWeight: childActive ? 600 : 400,
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                )}
              </motion.div>
            );
          })}
        </List>
      </Box>

      {/* User Info */}
      <Divider sx={{ borderColor: alpha(GOLD, 0.12) }} />
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={user?.profilePhotoUrl}
            sx={{
              width: 36,
              height: 36,
              bgcolor: GOLD,
              color: '#0D0D0D',
              fontWeight: 700,
            }}
          >
            {user?.firstName?.charAt(0) || 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ color: '#FFFFFF' }}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: alpha(GOLD, 0.7) }}>
              {role?.replace('_', ' ')}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={sidebarOpen && isMobile}
        onClose={() => dispatch(setSidebarOpen(false))}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#0D0D0D',
            borderRight: `1px solid ${alpha(GOLD, 0.1)}`,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="persistent"
        open={sidebarOpen}
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#0D0D0D',
            borderRight: `1px solid ${alpha(GOLD, 0.1)}`,
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Sidebar;
