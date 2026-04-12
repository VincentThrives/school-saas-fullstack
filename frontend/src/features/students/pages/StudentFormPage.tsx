import { useEffect, useMemo } from 'react';
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
import { useGetStudentByIdQuery, useCreateStudentMutation, useUpdateStudentMutation } from '../../../store/api/studentsApi';
import { useGetClassesQuery } from '../../../store/api/classesApi';
import { Gender } from '../../../types';
import { useSnackbar } from 'notistack';

const studentSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  rollNumber: z.string().min(1, 'Roll number is required'),
  admissionNumber: z.string().min(1, 'Admission number is required'),
  classId: z.string().min(1, 'Class is required'),
  sectionId: z.string().min(1, 'Section is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.nativeEnum(Gender),
  bloodGroup: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zip: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

export const StudentFormPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { studentId } = useParams<{ studentId: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(studentId && studentId !== 'new');

  const { data: studentData, isLoading: studentLoading } = useGetStudentByIdQuery(studentId!, {
    skip: !isEditing,
  });

  const { data: classesData } = useGetClassesQuery();
  const [createStudent, { isLoading: creating }] = useCreateStudentMutation();
  const [updateStudent, { isLoading: updating }] = useUpdateStudentMutation();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      rollNumber: '',
      admissionNumber: '',
      classId: '',
      sectionId: '',
      dateOfBirth: '',
      gender: Gender.MALE,
      bloodGroup: '',
      street: '',
      city: '',
      state: '',
      country: '',
      zip: '',
    },
  });

  const selectedClassId = watch('classId');
  const classes = classesData?.data || [];
  const sections = useMemo(() => {
    const selectedClass = classes.find((c) => c.classId === selectedClassId);
    return selectedClass?.sections || [];
  }, [classes, selectedClassId]);

  useEffect(() => {
    dispatch(setPageTitle(isEditing ? 'Edit Student' : 'Add Student'));
  }, [dispatch, isEditing]);

  useEffect(() => {
    if (studentData?.data) {
      const student = studentData.data;
      reset({
        email: student.user?.email || '',
        password: '',
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        phone: student.user?.phone || '',
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        classId: student.classId,
        sectionId: student.sectionId,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        bloodGroup: student.bloodGroup || '',
        street: student.address?.street || '',
        city: student.address?.city || '',
        state: student.address?.state || '',
        country: student.address?.country || '',
        zip: student.address?.zip || '',
      });
    }
  }, [studentData, reset]);

  const onSubmit = async (data: StudentFormData) => {
    try {
      const payload = {
        email: data.email,
        password: data.password || 'TempPass123!',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || '',
        rollNumber: data.rollNumber,
        admissionNumber: data.admissionNumber,
        classId: data.classId,
        sectionId: data.sectionId,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        address: {
          street: data.street || '',
          city: data.city || '',
          state: data.state || '',
          country: data.country || '',
          zip: data.zip || '',
        },
      };

      if (isEditing && studentId) {
        await updateStudent({
          studentId,
          data: payload,
        }).unwrap();
        enqueueSnackbar('Student updated successfully', { variant: 'success' });
      } else {
        await createStudent(payload).unwrap();
        enqueueSnackbar('Student created successfully', { variant: 'success' });
      }
      navigate('/students');
    } catch {
      enqueueSnackbar('Failed to save student', { variant: 'error' });
    }
  };

  if (studentLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={isEditing ? 'Edit Student' : 'Add New Student'}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Students', path: '/students' },
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

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="dateOfBirth"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Date of Birth"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.dateOfBirth}
                      helperText={errors.dateOfBirth?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.gender}>
                      <InputLabel>Gender</InputLabel>
                      <Select {...field} label="Gender">
                        <MenuItem value={Gender.MALE}>Male</MenuItem>
                        <MenuItem value={Gender.FEMALE}>Female</MenuItem>
                        <MenuItem value={Gender.OTHER}>Other</MenuItem>
                      </Select>
                      {errors.gender && <FormHelperText>{errors.gender.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="bloodGroup"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Blood Group</InputLabel>
                      <Select {...field} label="Blood Group">
                        <MenuItem value="">Not Specified</MenuItem>
                        <MenuItem value="A+">A+</MenuItem>
                        <MenuItem value="A-">A-</MenuItem>
                        <MenuItem value="B+">B+</MenuItem>
                        <MenuItem value="B-">B-</MenuItem>
                        <MenuItem value="AB+">AB+</MenuItem>
                        <MenuItem value="AB-">AB-</MenuItem>
                        <MenuItem value="O+">O+</MenuItem>
                        <MenuItem value="O-">O-</MenuItem>
                      </Select>
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
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Academic Information
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="admissionNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Admission Number"
                      disabled={isEditing}
                      error={!!errors.admissionNumber}
                      helperText={errors.admissionNumber?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="rollNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Roll Number"
                      error={!!errors.rollNumber}
                      helperText={errors.rollNumber?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="classId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.classId}>
                      <InputLabel>Class</InputLabel>
                      <Select
                        {...field}
                        label="Class"
                        onChange={(e) => {
                          field.onChange(e);
                        }}
                      >
                        {classes.map((cls) => (
                          <MenuItem key={cls.classId} value={cls.classId}>
                            {cls.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.classId && <FormHelperText>{errors.classId.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="sectionId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.sectionId} disabled={!selectedClassId}>
                      <InputLabel>Section</InputLabel>
                      <Select {...field} label="Section">
                        {sections.map((section) => (
                          <MenuItem key={section.sectionId} value={section.sectionId}>
                            {section.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.sectionId && <FormHelperText>{errors.sectionId.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Address
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="street"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Street Address"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="City"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="State"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Country"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="zip"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="ZIP/Postal Code"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/students')}
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
                      'Update Student'
                    ) : (
                      'Create Student'
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

export default StudentFormPage;
