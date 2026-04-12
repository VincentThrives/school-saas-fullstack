import { useEffect, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import {
  useGetClassByIdQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useGetAcademicYearsQuery,
  useCreateSectionMutation,
  useUpdateSectionMutation,
  useDeleteSectionMutation,
} from '../../../store/api/classesApi';
import { useGetTeachersQuery } from '../../../store/api/teachersApi';
import { Section } from '../../../types';
import { useSnackbar } from 'notistack';

const classSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  grade: z.number().min(1, 'Grade must be at least 1').max(12, 'Grade must be at most 12'),
  academicYearId: z.string().min(1, 'Academic year is required'),
});

const sectionSchema = z.object({
  name: z.string().min(1, 'Section name is required'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  classTeacherId: z.string().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;
type SectionFormData = z.infer<typeof sectionSchema>;

export const ClassFormPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { classId } = useParams<{ classId: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(classId && classId !== 'new');

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  const { data: classData, isLoading: classLoading, refetch } = useGetClassByIdQuery(classId!, {
    skip: !isEditing,
  });

  const { data: academicYearsData } = useGetAcademicYearsQuery();
  const { data: teachersData } = useGetTeachersQuery({ page: 0, size: 100 });

  const [createClass, { isLoading: creating }] = useCreateClassMutation();
  const [updateClass, { isLoading: updating }] = useUpdateClassMutation();
  const [createSection] = useCreateSectionMutation();
  const [updateSection] = useUpdateSectionMutation();
  const [deleteSection] = useDeleteSectionMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      grade: 1,
      academicYearId: '',
    },
  });

  const {
    control: sectionControl,
    handleSubmit: handleSectionSubmit,
    reset: resetSection,
    formState: { errors: sectionErrors },
  } = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      name: '',
      capacity: 40,
      classTeacherId: '',
    },
  });

  useEffect(() => {
    dispatch(setPageTitle(isEditing ? 'Edit Class' : 'Add Class'));
  }, [dispatch, isEditing]);

  useEffect(() => {
    if (classData?.data) {
      reset({
        name: classData.data.name,
        grade: classData.data.grade,
        academicYearId: classData.data.academicYearId,
      });
    }
  }, [classData, reset]);

  useEffect(() => {
    if (academicYearsData?.data && !isEditing) {
      const currentYear = academicYearsData.data.find((y) => y.isCurrent);
      if (currentYear) {
        reset((prev) => ({ ...prev, academicYearId: currentYear.academicYearId }));
      }
    }
  }, [academicYearsData, isEditing, reset]);

  const onSubmit = async (data: ClassFormData) => {
    try {
      if (isEditing && classId) {
        await updateClass({
          classId,
          data: {
            name: data.name,
            grade: data.grade,
          },
        }).unwrap();
        enqueueSnackbar('Class updated successfully', { variant: 'success' });
      } else {
        await createClass(data).unwrap();
        enqueueSnackbar('Class created successfully', { variant: 'success' });
        navigate('/classes');
      }
    } catch {
      enqueueSnackbar('Failed to save class', { variant: 'error' });
    }
  };

  const handleOpenSectionDialog = (section?: Section) => {
    if (section) {
      setEditingSection(section);
      resetSection({
        name: section.name,
        capacity: section.capacity,
        classTeacherId: section.classTeacherId || '',
      });
    } else {
      setEditingSection(null);
      resetSection({
        name: '',
        capacity: 40,
        classTeacherId: '',
      });
    }
    setSectionDialogOpen(true);
  };

  const handleCloseSectionDialog = () => {
    setSectionDialogOpen(false);
    setEditingSection(null);
    resetSection();
  };

  const onSectionSubmit = async (data: SectionFormData) => {
    try {
      if (editingSection) {
        await updateSection({
          classId: classId!,
          sectionId: editingSection.sectionId,
          data: {
            name: data.name,
            capacity: data.capacity,
            classTeacherId: data.classTeacherId || undefined,
          },
        }).unwrap();
        enqueueSnackbar('Section updated successfully', { variant: 'success' });
      } else {
        await createSection({
          classId: classId!,
          name: data.name,
          capacity: data.capacity,
          classTeacherId: data.classTeacherId || undefined,
        }).unwrap();
        enqueueSnackbar('Section created successfully', { variant: 'success' });
      }
      handleCloseSectionDialog();
      refetch();
    } catch {
      enqueueSnackbar('Failed to save section', { variant: 'error' });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await deleteSection({ classId: classId!, sectionId }).unwrap();
      enqueueSnackbar('Section deleted successfully', { variant: 'success' });
      refetch();
    } catch {
      enqueueSnackbar('Failed to delete section', { variant: 'error' });
    }
  };

  if (classLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const academicYears = academicYearsData?.data || [];
  const teachers = teachersData?.data?.content || [];
  const sections = classData?.data?.sections || [];

  return (
    <Box>
      <PageHeader
        title={isEditing ? 'Edit Class' : 'Add New Class'}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Classes', path: '/classes' },
          { label: isEditing ? 'Edit' : 'Add' },
        ]}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Class Information
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Class Name"
                      placeholder="e.g., Class 10, Grade 5"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="grade"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Grade Level"
                      type="number"
                      inputProps={{ min: 1, max: 12 }}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      error={!!errors.grade}
                      helperText={errors.grade?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
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

              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/classes')}
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
                      'Update Class'
                    ) : (
                      'Create Class'
                    )}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* Sections Management - Only show when editing */}
      {isEditing && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Sections
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                size="small"
                onClick={() => handleOpenSectionDialog()}
              >
                Add Section
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Section Name</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Students</TableCell>
                    <TableCell>Class Teacher</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        No sections added yet. Click "Add Section" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sections.map((section) => (
                      <TableRow key={section.sectionId}>
                        <TableCell>{section.name}</TableCell>
                        <TableCell>{section.capacity}</TableCell>
                        <TableCell>{section.studentCount}</TableCell>
                        <TableCell>{section.classTeacherName || 'Not Assigned'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenSectionDialog(section)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSection(section.sectionId)}
                            disabled={section.studentCount > 0}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onClose={handleCloseSectionDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSectionSubmit(onSectionSubmit)}>
          <DialogTitle>{editingSection ? 'Edit Section' : 'Add Section'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="name"
                  control={sectionControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Section Name"
                      placeholder="e.g., A, B, C"
                      error={!!sectionErrors.name}
                      helperText={sectionErrors.name?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="capacity"
                  control={sectionControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Capacity"
                      type="number"
                      inputProps={{ min: 1 }}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      error={!!sectionErrors.capacity}
                      helperText={sectionErrors.capacity?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="classTeacherId"
                  control={sectionControl}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Class Teacher (Optional)</InputLabel>
                      <Select {...field} label="Class Teacher (Optional)">
                        <MenuItem value="">Not Assigned</MenuItem>
                        {teachers.map((teacher) => (
                          <MenuItem key={teacher.teacherId} value={teacher.teacherId}>
                            {teacher.user?.firstName} {teacher.user?.lastName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSectionDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingSection ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ClassFormPage;
