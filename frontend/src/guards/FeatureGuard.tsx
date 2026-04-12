import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store';
import { selectFeatureFlags, selectIsSuperAdmin } from '../store/slices/authSlice';
import { FeatureKey } from '../types';
import { Box, Typography, Button, Paper } from '@mui/material';
import { ExtensionOff as ExtensionOffIcon } from '@mui/icons-material';

interface FeatureGuardProps {
  children: ReactNode;
  feature: FeatureKey;
  fallback?: 'redirect' | 'unavailable' | 'hidden';
  redirectTo?: string;
}

export const FeatureGuard = ({
  children,
  feature,
  fallback = 'unavailable',
  redirectTo = '/dashboard',
}: FeatureGuardProps) => {
  const featureFlags = useAppSelector(selectFeatureFlags);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);

  // Super Admin can access everything
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check if feature is enabled
  const isFeatureEnabled = featureFlags[feature] ?? false;

  if (isFeatureEnabled) {
    return <>{children}</>;
  }

  // Handle disabled feature
  if (fallback === 'hidden') {
    return null;
  }

  if (fallback === 'redirect') {
    return <Navigate to={redirectTo} replace />;
  }

  // Show feature unavailable page
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
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 500,
          bgcolor: 'grey.50',
          borderRadius: 3,
        }}
      >
        <ExtensionOffIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Feature Not Available
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The <strong>{getFeatureDisplayName(feature)}</strong> feature is not enabled
          for your school. Please contact your school administrator to enable this
          feature.
        </Typography>
        <Button variant="contained" href="/dashboard">
          Go to Dashboard
        </Button>
      </Paper>
    </Box>
  );
};

// Feature display names
const featureDisplayNames: Record<FeatureKey, string> = {
  attendance: 'Attendance Management',
  timetable: 'Timetable Management',
  exams: 'Exam & Marks',
  mcq: 'Online MCQ Exams',
  fee: 'Fee Management',
  notifications: 'Notifications',
  events: 'Events & Calendar',
  messaging: 'Internal Messaging',
  content: 'Study Materials',
  report_cards: 'Report Cards',
  bulk_import: 'Bulk Import',
  parent_portal: 'Parent Portal',
  analytics: 'Analytics & Reports',
};

const getFeatureDisplayName = (feature: FeatureKey): string => {
  return featureDisplayNames[feature] || feature;
};

// Hook to check if a feature is enabled
export const useFeatureEnabled = (feature: FeatureKey): boolean => {
  const featureFlags = useAppSelector(selectFeatureFlags);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);

  if (isSuperAdmin) return true;
  return featureFlags[feature] ?? false;
};

// Component to conditionally render based on feature
export const FeatureEnabled = ({
  feature,
  children,
  fallback = null,
}: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const isEnabled = useFeatureEnabled(feature);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

export default FeatureGuard;
