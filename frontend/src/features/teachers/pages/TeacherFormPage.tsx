import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Typography,
  Divider,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetTeacherByIdQuery, useCreateTeacherMutation, useUpdateTeacherMutation } from '../../../store/api/teachersApi';
import { useSnackbar } from 'notistack';

const teacherSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
});

type TeacherFormData = z.infer<typeof teacherSchema>;

export const TeacherFormPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { teacherId } = useParams<{ teacherId: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(teacherId && teacherId !== 'new');

  const { data: teacherData, isLoading: teacherLoading } = useGetTeacherByIdQuery(teacherId!, {
    skip: !isEditing,
  });

  const [createTeacher, { isLoading: creating }] = useCreateTeacherMutation();
  const [updateTeacher, { isLoading: updating }] = useUpdateTeacherMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      employeeId: '',
      qualification: '',
      specialization: '',
      joiningDate: '',
    },
  });

  useEffect(() => {
    dispatch(setPageTitle(isEditing ? 'Edit Teacher' : 'Add Teacher'));
  }, [dispatch, isEditing]);

  useEffect(() => {
    if (teacherData?.data) {
      const teacher = teacherData.data;
      reset({
        email: teacher.user?.email || '',
        password: '',
        firstName: teacher.user?.firstName || '',
        lastName: teacher.user?.lastName || '',
        phone: teacher.user?.phone || '',
        employeeId: teacher.employeeId,
        qualification: teacher.qualification,
        specialization: teacher.specialization,
        joiningDate: teacher.joiningDate,
      });
    }
  }, [teacherData, reset]);

  const onSubmit = async (data: TeacherFormData) => {
    try {
      const payload = {
        email: data.email,
        password: data.password || 'TempPass123!',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || '',
        employeeId: data.employeeId,
        qualification: data.qualification,
        specialization: data.specialization,
        joiningDate: data.joiningDate,
      };

      if (isEditing && teacherId) {
        await updateTeacher({
          teacherId,
          data: payload,
        }).unwrap();
        enqueueSnackbar('Teacher updated successfully', { variant: 'success' });
      } else {
        await createTeacher(payload).unwrap();
        enqueueSnackbar('Teacher created successfully', { variant: 'success' });
      }
      navigate('/teachers');
    } catch {
      enqueueSnackbar('Failed to save teacher', { variant: 'error' });
    }
  };

  if (teacherLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={isEditing ? 'Edit Teacher' : 'Add New Teacher'}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Teachers', path: '/teachers' },
          { label: isEditing ? 'Edit' : 'Add' },
        ]}
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Personal Information
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="firstName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="First Name"
                      error={!!errors.firstName}
                      helperText={errors.firstName?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="lastName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Last Name"
                      error={!!errors.lastName}
                      helperText={errors.lastName?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email"
                      type="email"
                      disabled={isEditing}
                      error={!!errors.email}
                      helperText={errors.email?.message || (isEditing ? 'Email cannot be changed' : '')}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Phone"
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                    />
                  )}
                />
              </Grid>

              {!isEditing && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Password"
                        type="password"
                        error={!!errors.password}
                        helperText={errors.password?.message || 'Leave empty for auto-generated password'}
                      />
                    )}
                  />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Employment Information
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="employeeId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Employee ID"
                      disabled={isEditing}
                      error={!!errors.employeeId}
                      helperText={errors.employeeId?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="joiningDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Joining Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.joiningDate}
                      helperText={errors.joiningDate?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="qualification"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Qualification"
                      placeholder="e.g., M.Sc., B.Ed."
                      error={!!errors.qualification}
                      helperText={errors.qualification?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="specialization"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Specialization"
                      placeholder="e.g., Mathematics, Physics"
                      error={!!errors.specialization}
                      helperText={errors.specialization?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/teachers')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={creating || updating}
                  >
                    {creating || updating ? (
                      <CircularProgress size={20} />
                    ) : isEditing ? (
                      'Update Teacher'
                    ) : (
                      'Create Teacher'
                    )}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeacherFormPage;
