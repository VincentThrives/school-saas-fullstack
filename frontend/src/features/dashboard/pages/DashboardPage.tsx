import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../../store';
import { selectRole, selectIsSuperAdmin } from '../../../store/slices/authSlice';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { UserRole } from '../../../types';

// Import role-specific dashboards
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { SchoolAdminDashboard } from './SchoolAdminDashboard';
import { PrincipalDashboard } from './PrincipalDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { StudentDashboard } from './StudentDashboard';
import { ParentDashboard } from './ParentDashboard';

export const DashboardPage = () => {
  const dispatch = useAppDispatch();
  const role = useAppSelector(selectRole);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);

  useEffect(() => {
    dispatch(setPageTitle('Dashboard'));
  }, [dispatch]);

  // Render the appropriate dashboard based on role
  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  switch (role) {
    case UserRole.SCHOOL_ADMIN:
      return <SchoolAdminDashboard />;
    case UserRole.PRINCIPAL:
      return <PrincipalDashboard />;
    case UserRole.TEACHER:
      return <TeacherDashboard />;
    case UserRole.STUDENT:
      return <StudentDashboard />;
    case UserRole.PARENT:
      return <ParentDashboard />;
    default:
      return <SchoolAdminDashboard />;
  }
};

export default DashboardPage;
