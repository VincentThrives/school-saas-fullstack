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
  CircularProgress,
  alpha,
} from '@mui/material';
import { School as SchoolIcon, ArrowForward } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useResolveTenantMutation } from '../../../store/api/authApi';
import { useAppDispatch } from '../../../store';
import { setSchoolInfo, setResolving, setTenantError } from '../../../store/slices/tenantSlice';

const GOLD = '#D4A843';
const GOLD_DARK = '#B8860B';

export const SchoolIdPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [schoolId, setSchoolId] = useState('');
  const [resolveTenant, { isLoading, error }] = useResolveTenantMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId.trim()) return;
    dispatch(setResolving(true));
    try {
      const result = await resolveTenant({ schoolId: schoolId.trim() }).unwrap();
      if (result.success && result.data) {
        dispatch(setSchoolInfo({
          tenantId: result.data.tenantId,
          schoolName: result.data.schoolName,
          logoUrl: result.data.logoUrl,
          status: result.data.status,
        }));
        navigate('/login/credentials');
      }
    } catch (err) {
      const errorMessage = (err as { data?: { message?: string } })?.data?.message || 'School not found. Please check your School ID.';
      dispatch(setTenantError(errorMessage));
    }
  };

  const getErrorMessage = () => {
    if (!error) return null;
    if ('data' in error) {
      const data = error.data as { message?: string };
      return data?.message || 'School not found. Please check your School ID.';
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
            backdropFilter: 'blur(20px)',
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
                    boxShadow: `0 8px 24px ${alpha(GOLD, 0.35)}`,
                  }}
                >
                  <SchoolIcon sx={{ fontSize: 36, color: 'white' }} />
                </Box>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Typography variant="h4" fontWeight={800} gutterBottom sx={{ color: '#1A1A1A' }}>
                  School Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter your school ID to continue
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
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <TextField
                fullWidth
                label="School ID"
                placeholder="e.g., greenwood or SCH-00123"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SchoolIcon sx={{ color: GOLD }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
                autoFocus
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={!schoolId.trim() || isLoading}
                endIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                  color: '#FFFFFF',
                  boxShadow: `0 4px 16px ${alpha(GOLD, 0.35)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, #E8C97A 0%, ${GOLD} 100%)`,
                    boxShadow: `0 6px 24px ${alpha(GOLD, 0.45)}`,
                  },
                  '&:disabled': {
                    background: alpha('#1A1A1A', 0.12),
                    color: alpha('#1A1A1A', 0.4),
                  },
                }}
              >
                {isLoading ? 'Finding School...' : 'Continue'}
              </Button>
            </motion.form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Are you a Super Admin?{' '}
                <RouterLink
                  to="/superadmin"
                  style={{ color: GOLD_DARK, fontWeight: 700, textDecoration: 'none' }}
                >
                  Login here
                </RouterLink>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </motion.div>

      {/* Decorative gold lines */}
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

export default SchoolIdPage;
