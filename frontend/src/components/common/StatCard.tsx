import { ReactNode } from 'react';
import { Card, CardContent, Box, Typography, alpha, SxProps, Theme } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { motion } from 'framer-motion';

const GOLD = '#D4A843';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  trend?: {
    value: number;
    label?: string;
  };
  sx?: SxProps<Theme>;
  delay?: number;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  trend,
  sx,
  delay = 0,
}: StatCardProps) => {
  const isPositiveTrend = trend && trend.value >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card
        sx={{
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${GOLD}, #B8860B)`,
          },
          ...sx,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={500}>
              {title}
            </Typography>
            {icon && (
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
                  color: `${color}.main`,
                  transition: 'all 0.3s ease',
                }}
              >
                {icon}
              </Box>
            )}
          </Box>

          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              mb: 0.5,
              background: `linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {value}
          </Typography>

          {(subtitle || trend) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {trend && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: isPositiveTrend
                      ? (theme: Theme) => alpha(theme.palette.success.main, 0.1)
                      : (theme: Theme) => alpha(theme.palette.error.main, 0.1),
                    color: isPositiveTrend ? 'success.main' : 'error.main',
                  }}
                >
                  {isPositiveTrend ? (
                    <TrendingUp sx={{ fontSize: 16 }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: 16 }} />
                  )}
                  <Typography variant="caption" fontWeight={700}>
                    {Math.abs(trend.value)}%
                  </Typography>
                </Box>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatCard;
