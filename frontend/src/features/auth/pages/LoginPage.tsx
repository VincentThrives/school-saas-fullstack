import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Avatar,
  Divider,
  alpha,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  ArrowBack,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useLoginMutation } from '../../../store/api/authApi';
import { useAppDispatch, useAppSelector } from '../../../store';
import { setCredentials } from '../../../store/slices/authSlice';
import { selectSchoolInfo, clearTenant } from '../../../store/slices/tenantSlice';
import { FeatureKey } from '../../../types';

const GOLD = '#D4A843';
const GOLD_DARK = '#B8860B';

const loginSchema = z.object({
  username: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const schoolInfo = useAppSelector(selectSchoolInfo);
  const [showPassword, setShowPassword] = useState(false);
  const [login, { isLoading, error }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  if (!schoolInfo) {
    navigate('/login', { replace: true });
    return null;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await login({
        tenantId: schoolInfo.tenantId,
        username: data.username,
        password: data.password,
      }).unwrap();

      if (result.success && result.data) {
        dispatch(setCredentials({
          user: result.data.user,
          role: result.data.role,
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          featureFlags: result.data.featureFlags as Record<FeatureKey, boolean>,
        }));
        navigate('/dashboard', { replace: true });
      }
    } catch {
      // Error handled by RTK Query
    }
  };

  const handleBack = () => {
    dispatch(clearTenant());
    navigate('/login');
  };

  const getErrorMessage = () => {
    if (!error) return null;
    if ('data' in error) {
      const data = error.data as { message?: string };
      if (data?.message?.includes('locked')) {
        return 'Account locked due to multiple failed attempts. Contact your school admin.';
      }
      return data?.message || 'Incorrect username or password.';
    }
    return 'Unable to connect. Please try again.';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, #0D0D0D 0%, #1A1A1A 40%, #2D2D2D 100%)`,
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: `radial-gradient(circle at 30% 40%, ${alpha(GOLD, 0.06)} 0%, transparent 50%), radial-gradient(circle at 70% 60%, ${alpha(GOLD, 0.04)} 0%, transparent 50%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <Card
          sx={{
            maxWidth: 440,
            width: '100%',
            border: `1px solid ${alpha(GOLD, 0.15)}`,
            bgcolor: alpha('#FFFFFF', 0.98),
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* School Branding */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <Avatar
                  src={schoolInfo.logoUrl}
                  sx={{
                    width: 76,
                    height: 76,
                    mx: 'auto',
                    mb: 2,
                    background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    boxShadow: `0 8px 24px ${alpha(GOLD, 0.35)}`,
                  }}
                >
                  {schoolInfo.schoolName.charAt(0)}
                </Avatar>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  {schoolInfo.schoolName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to your account
                </Typography>
              </motion.div>
            </Box>

            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                  {getErrorMessage()}
                </Alert>
              </motion.div>
            )}

            <motion.form
              onSubmit={handleSubmit(onSubmit)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <TextField
                fullWidth
                label="Email or Username"
                {...register('username')}
                error={!!errors.username}
                helperText={errors.username?.message}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: GOLD }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
                autoFocus
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: GOLD }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 1 }}
              />

              <Box sx={{ textAlign: 'right', mb: 3 }}>
                <RouterLink
                  to="/forgot-password"
                  style={{ color: GOLD_DARK, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
                >
                  Forgot password?
                </RouterLink>
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                  color: '#FFFFFF',
                  boxShadow: `0 4px 16px ${alpha(GOLD, 0.35)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, #E8C97A 0%, ${GOLD} 100%)`,
                    boxShadow: `0 6px 24px ${alpha(GOLD, 0.45)}`,
                  },
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </motion.form>

            <Divider sx={{ my: 3, borderColor: alpha(GOLD, 0.15) }} />

            <Button
              variant="text"
              fullWidth
              startIcon={<ArrowBack />}
              onClick={handleBack}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: alpha(GOLD, 0.06) } }}
            >
              Use a different School ID
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
        }}
      />
    </Box>
  );
};

export default LoginPage;
