import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetUserByIdQuery, useCreateUserMutation, useUpdateUserMutation } from '../../../store/api/usersApi';
import { UserRole } from '../../../types';
import { useSnackbar } from 'notistack';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
});

type UserFormData = z.infer<typeof userSchema>;

export const UserFormPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { userId } = useParams<{ userId: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(userId && userId !== 'new');

  const { data: userData, isLoading: userLoading } = useGetUserByIdQuery(userId!, {
    skip: !isEditing,
  });

  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: UserRole.TEACHER,
    },
  });

  useEffect(() => {
    dispatch(setPageTitle(isEditing ? 'Edit User' : 'Add User'));
  }, [dispatch, isEditing]);

  useEffect(() => {
    if (userData?.data) {
      reset({
        email: userData.data.email,
        password: '',
        firstName: userData.data.firstName,
        lastName: userData.data.lastName,
        phone: userData.data.phone || '',
        role: userData.data.role,
      });
    }
  }, [userData, reset]);

  const onSubmit = async (data: UserFormData) => {
    try {
      if (isEditing && userId) {
        await updateUser({
          userId,
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
          },
        }).unwrap();
        enqueueSnackbar('User updated successfully', { variant: 'success' });
      } else {
        await createUser({
          email: data.email,
          password: data.password || 'TempPass123!',
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || '',
          role: data.role,
        }).unwrap();
        enqueueSnackbar('User created successfully', { variant: 'success' });
      }
      navigate('/users');
    } catch (error) {
      enqueueSnackbar('Failed to save user', { variant: 'error' });
    }
  };

  if (userLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={isEditing ? 'Edit User' : 'Add New User'}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Users', path: '/users' },
          { label: isEditing ? 'Edit' : 'Add' },
        ]}
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
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

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.role} disabled={isEditing}>
                      <InputLabel>Role</InputLabel>
                      <Select {...field} label="Role">
                        <MenuItem value={UserRole.SCHOOL_ADMIN}>School Admin</MenuItem>
                        <MenuItem value={UserRole.PRINCIPAL}>Principal</MenuItem>
                        <MenuItem value={UserRole.TEACHER}>Teacher</MenuItem>
                        <MenuItem value={UserRole.STUDENT}>Student</MenuItem>
                        <MenuItem value={UserRole.PARENT}>Parent</MenuItem>
                      </Select>
                      {errors.role && <FormHelperText>{errors.role.message}</FormHelperText>}
                      {isEditing && <FormHelperText>Role cannot be changed</FormHelperText>}
                    </FormControl>
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

              {!isEditing && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info">
                    A welcome email with login credentials will be sent to the user's email address.
                  </Alert>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/users')}
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
                      'Update User'
                    ) : (
                      'Create User'
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

export default UserFormPage;
