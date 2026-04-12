import { ReactNode } from 'react';
import { Box, Typography, Breadcrumbs, Link, Button, SxProps, Theme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext } from '@mui/icons-material';

interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  action?: {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    href?: string;
    variant?: 'contained' | 'outlined' | 'text';
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  };
  secondaryAction?: {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    href?: string;
  };
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

export const PageHeader = ({
  title,
  subtitle,
  breadcrumbs,
  action,
  secondaryAction,
  children,
  sx,
}: PageHeaderProps) => {
  return (
    <Box sx={{ mb: 3, ...sx }}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNext fontSize="small" />}
          sx={{ mb: 1 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (isLast || !crumb.path) {
              return (
                <Typography
                  key={crumb.label}
                  variant="body2"
                  color={isLast ? 'text.primary' : 'text.secondary'}
                  fontWeight={isLast ? 500 : 400}
                >
                  {crumb.label}
                </Typography>
              );
            }

            return (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.path}
                color="text.secondary"
                underline="hover"
                variant="body2"
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Title and Actions Row */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={600}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        {(action || secondaryAction) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {secondaryAction && (
              <Button
                variant="outlined"
                startIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
                {...(secondaryAction.href && {
                  component: RouterLink,
                  to: secondaryAction.href,
                })}
              >
                {secondaryAction.label}
              </Button>
            )}
            {action && (
              <Button
                variant={action.variant || 'contained'}
                color={action.color || 'primary'}
                startIcon={action.icon}
                onClick={action.onClick}
                {...(action.href && {
                  component: RouterLink,
                  to: action.href,
                })}
              >
                {action.label}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Optional children content */}
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
};

export default PageHeader;
