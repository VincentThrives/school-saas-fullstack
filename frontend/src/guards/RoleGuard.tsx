import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store';
import { selectRole, selectIsAuthenticated } from '../store/slices/authSlice';
import { UserRole } from '../types';
import { Box, Typography, Button } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: 'redirect' | 'forbidden';
  redirectTo?: string;
}

export const RoleGuard = ({
  children,
  allowedRoles,
  fallback = 'forbidden',
  redirectTo = '/dashboard',
}: RoleGuardProps) => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);

  // If not authenticated, let AuthGuard handle it
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user's role is in allowed roles
  if (role && allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  // Handle unauthorized access
  if (fallback === 'redirect') {
    return <Navigate to={redirectTo} replace />;
  }

  // Show forbidden page
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        p: 3,
      }}
    >
      <BlockIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        Access Denied
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        You don't have permission to access this page. Please contact your administrator
        if you believe this is an error.
      </Typography>
      <Button variant="contained" href="/dashboard">
        Go to Dashboard
      </Button>
    </Box>
  );
};

// HOC for role-based access
export const withRoleGuard = (
  Component: React.ComponentType,
  allowedRoles: UserRole[],
  options?: Omit<RoleGuardProps, 'children' | 'allowedRoles'>
) => {
  return function RoleGuardedComponent(props: Record<string, unknown>) {
    return (
      <RoleGuard allowedRoles={allowedRoles} {...options}>
        <Component {...props} />
      </RoleGuard>
    );
  };
};

export default RoleGuard;
