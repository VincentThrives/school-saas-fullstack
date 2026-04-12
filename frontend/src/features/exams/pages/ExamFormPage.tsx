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
  Typography,
  Chip,
  OutlinedInput,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetExamByIdQuery, useCreateExamMutation, useUpdateExamMutation } from '../../../store/api/examsApi';
import { useGetSubjectsQuery, useGetClassesQuery, useGetAcademicYearsQuery } from '../../../store/api/classesApi';
import { useSnackbar } from 'notistack';

const examSchema = z.object({
  name: z.string().min(1, 'Exam name is required'),
  academicYearId: z.string().min(1, 'Academic year is required'),
  classIds: z.array(z.string()).min(1, 'At least one class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  maxMarks: z.number().min(1, 'Max marks must be at least 1'),
  passingMarks: z.number().min(0, 'Passing marks must be at least 0'),
});

type ExamFormData = z.infer<typeof examSchema>;

export const ExamFormPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { examId } = useParams<{ examId: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(examId && examId !== 'new');

  const { data: examData, isLoading: examLoading } = useGetExamByIdQuery(examId!, {
    skip: !isEditing,
  });

  const { data: subjectsData } = useGetSubjectsQuery();
  const { data: classesData } = useGetClassesQuery();
  const { data: academicYearsData } = useGetAcademicYearsQuery();

  const [createExam, { isLoading: creating }] = useCreateExamMutation();
  const [updateExam, { isLoading: updating }] = useUpdateExamMutation();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: '',
      academicYearId: '',
      classIds: [],
      subjectId: '',
      date: '',
      startTime: '09:00',
      endTime: '12:00',
      maxMarks: 100,
      passingMarks: 35,
    },
  });

  const subjects = subjectsData?.data || [];
  const classes = classesData?.data || [];
  const academicYears = academicYearsData?.data || [];

  useEffect(() => {
    dispatch(setPageTitle(isEditing ? 'Edit Exam' : 'Create Exam'));
  }, [dispatch, isEditing]);

  useEffect(() => {
    if (examData?.data) {
      const exam = examData.data;
      reset({
        name: exam.name,
        academicYearId: exam.academicYearId,
        classIds: exam.classIds,
        subjectId: exam.subjectId,
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime,
        maxMarks: exam.maxMarks,
        passingMarks: exam.passingMarks,
      });
    }
  }, [examData, reset]);

  useEffect(() => {
    if (academicYears.length > 0 && !isEditing) {
      const currentYear = academicYears.find((y) => y.isCurrent);
      if (currentYear) {
        reset((prev) => ({ ...prev, academicYearId: currentYear.academicYearId }));
      }
    }
  }, [academicYears, isEditing, reset]);

  const onSubmit = async (data: ExamFormData) => {
    try {
      if (isEditing && examId) {
        await updateExam({
          examId,
          data: {
            name: data.name,
            classIds: data.classIds,
            subjectId: data.subjectId,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            maxMarks: data.maxMarks,
            passingMarks: data.passingMarks,
          },
        }).unwrap();
        enqueueSnackbar('Exam updated successfully', { variant: 'success' });
      } else {
        await createExam(data).unwrap();
        enqueueSnackbar('Exam created successfully', { variant: 'success' });
      }
      navigate('/exams');
    } catch {
      enqueueSnackbar('Failed to save exam', { variant: 'error' });
    }
  };

  if (examLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={isEditing ? 'Edit Exam' : 'Create New Exam'}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Exams', path: '/exams' },
          { label: isEditing ? 'Edit' : 'Create' },
        ]}
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Exam Name"
                      placeholder="e.g., Mid-Term Mathematics"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="academicYearId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.academicYearId} disabled={isEditing}>
                      <InputLabel>Academic Year</InputLabel>
                      <Select {...field} label="Academic Year">
                        {academicYears.map((year) => (
                          <MenuItem key={year.academicYearId} value={year.academicYearId}>
                            {year.label} {year.isCurrent && '(Current)'}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.academicYearId && (
                        <FormHelperText>{errors.academicYearId.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="subjectId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.subjectId}>
                      <InputLabel>Subject</InputLabel>
                      <Select {...field} label="Subject">
                        {subjects.map((subject) => (
                          <MenuItem key={subject.subjectId} value={subject.subjectId}>
                            {subject.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.subjectId && (
                        <FormHelperText>{errors.subjectId.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="classIds"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.classIds}>
                      <InputLabel>Classes</InputLabel>
                      <Select
                        {...field}
                        multiple
                        input={<OutlinedInput label="Classes" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const cls = classes.find((c) => c.classId === value);
                              return <Chip key={value} label={cls?.name || value} size="small" />;
                            })}
                          </Box>
                        )}
                      >
                        {classes.map((cls) => (
                          <MenuItem key={cls.classId} value={cls.classId}>
                            {cls.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.classIds && (
                        <FormHelperText>{errors.classIds.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Exam Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.date}
                      helperText={errors.date?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Start Time"
                      type="time"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.startTime}
                      helperText={errors.startTime?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="End Time"
                      type="time"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.endTime}
                      helperText={errors.endTime?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="maxMarks"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Maximum Marks"
                      type="number"
                      inputProps={{ min: 1 }}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      error={!!errors.maxMarks}
                      helperText={errors.maxMarks?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="passingMarks"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Passing Marks"
                      type="number"
                      inputProps={{ min: 0 }}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      error={!!errors.passingMarks}
                      helperText={errors.passingMarks?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/exams')}
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
                      'Update Exam'
                    ) : (
                      'Create Exam'
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

export default ExamFormPage;
