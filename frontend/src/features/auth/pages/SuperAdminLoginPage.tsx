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
  alpha,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useSuperAdminLoginMutation } from '../../../store/api/authApi';
import { useAppDispatch } from '../../../store';
import { setCredentials } from '../../../store/slices/authSlice';
import { FeatureKey } from '../../../types';

const GOLD = '#D4A843';
const GOLD_DARK = '#B8860B';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const SuperAdminLoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [login, { isLoading, error }] = useSuperAdminLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await login({
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
        navigate('/superadmin/dashboard', { replace: true });
      }
    } catch {
      // Error handled by RTK Query
    }
  };

  const getErrorMessage = () => {
    if (!error) return null;
    if ('status' in error && error.status === 429) {
      return 'Too many login attempts. Please wait before trying again.';
    }
    if ('data' in error) {
      const data = error.data as { message?: string };
      return data?.message || 'Invalid credentials.';
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
        background: 'linear-gradient(135deg, #000000 0%, #0D0D0D 30%, #1A1A1A 100%)',
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
          background: `radial-gradient(circle at 50% 50%, ${alpha(GOLD, 0.08)} 0%, transparent 40%)`,
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
            bgcolor: '#141414',
            border: `1px solid ${alpha(GOLD, 0.2)}`,
            color: '#F5F0E8',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2.5,
                    boxShadow: `0 8px 32px ${alpha(GOLD, 0.4)}`,
                  }}
                >
                  <AdminIcon sx={{ fontSize: 36, color: '#0D0D0D' }} />
                </Box>
              </motion.div>
              <Typography variant="h4" fontWeight={800} gutterBottom sx={{ color: '#F5F0E8' }}>
                Super Admin Portal
              </Typography>
              <Typography variant="body2" sx={{ color: alpha(GOLD, 0.7) }}>
                SaaS Administration Access
              </Typography>
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
                label="Username"
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
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    color: '#F5F0E8',
                    '& fieldset': { borderColor: alpha(GOLD, 0.2) },
                    '&:hover fieldset': { borderColor: alpha(GOLD, 0.4) },
                    '&.Mui-focused fieldset': { borderColor: GOLD },
                  },
                  '& .MuiInputLabel-root': { color: alpha('#F5F0E8', 0.5) },
                  '& .MuiInputLabel-root.Mui-focused': { color: GOLD },
                }}
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
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: alpha('#F5F0E8', 0.5) }}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    color: '#F5F0E8',
                    '& fieldset': { borderColor: alpha(GOLD, 0.2) },
                    '&:hover fieldset': { borderColor: alpha(GOLD, 0.4) },
                    '&.Mui-focused fieldset': { borderColor: GOLD },
                  },
                  '& .MuiInputLabel-root': { color: alpha('#F5F0E8', 0.5) },
                  '& .MuiInputLabel-root.Mui-focused': { color: GOLD },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                  color: '#0D0D0D',
                  fontWeight: 700,
                  boxShadow: `0 4px 20px ${alpha(GOLD, 0.4)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, #E8C97A 0%, ${GOLD} 100%)`,
                    boxShadow: `0 6px 28px ${alpha(GOLD, 0.5)}`,
                  },
                }}
              >
                {isLoading ? <CircularProgress size={24} sx={{ color: '#0D0D0D' }} /> : 'Sign In as Super Admin'}
              </Button>
            </motion.form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: alpha('#F5F0E8', 0.5) }}>
                School user?{' '}
                <RouterLink to="/login" style={{ color: GOLD, fontWeight: 700, textDecoration: 'none' }}>
                  Login here
                </RouterLink>
              </Typography>
            </Box>
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

export default SuperAdminLoginPage;
