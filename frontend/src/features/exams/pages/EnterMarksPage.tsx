import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  CircularProgress,
  Typography,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetExamByIdQuery, useGetExamMarksQuery, useEnterMarksBulkMutation, useLockMarksMutation, useGetMarksSummaryQuery } from '../../../store/api/examsApi';
import { useGetStudentsQuery } from '../../../store/api/studentsApi';
import { useGetClassesQuery } from '../../../store/api/classesApi';
import { useSnackbar } from 'notistack';

interface StudentMark {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  profilePhotoUrl?: string;
  marksObtained: number | '';
  remarks: string;
  isLocked: boolean;
}

export const EnterMarksPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);

  const { data: examData, isLoading: examLoading } = useGetExamByIdQuery(examId!);
  const { data: classesData } = useGetClassesQuery();

  const exam = examData?.data;
  const allClasses = classesData?.data || [];

  // Filter classes to only those in the exam
  const examClasses = useMemo(
    () => allClasses.filter((c) => exam?.classIds?.includes(c.classId)),
    [allClasses, exam]
  );

  const selectedClassData = useMemo(
    () => examClasses.find((c) => c.classId === selectedClass),
    [examClasses, selectedClass]
  );
  const sections = selectedClassData?.sections || [];

  const { data: studentsData, isLoading: studentsLoading } = useGetStudentsQuery(
    { classId: selectedClass, sectionId: selectedSection, size: 100 },
    { skip: !selectedClass || !selectedSection }
  );

  const { data: existingMarks, isLoading: marksLoading } = useGetExamMarksQuery(
    { examId: examId!, classId: selectedClass, sectionId: selectedSection },
    { skip: !examId || !selectedClass || !selectedSection }
  );

  const { data: summaryData } = useGetMarksSummaryQuery(
    { examId: examId!, classId: selectedClass, sectionId: selectedSection },
    { skip: !examId || !selectedClass || !selectedSection }
  );

  const [enterMarksBulk, { isLoading: saving }] = useEnterMarksBulkMutation();
  const [lockMarks, { isLoading: locking }] = useLockMarksMutation();

  useEffect(() => {
    dispatch(setPageTitle('Enter Marks'));
  }, [dispatch]);

  useEffect(() => {
    if (examClasses.length > 0 && !selectedClass) {
      setSelectedClass(examClasses[0].classId);
    }
  }, [examClasses, selectedClass]);

  useEffect(() => {
    if (studentsData?.data?.content) {
      const students = studentsData.data.content;
      const marksMap = new Map(
        existingMarks?.data?.map((m) => [m.studentId, m]) || []
      );

      setStudentMarks(
        students.map((student) => {
          const existing = marksMap.get(student.studentId);
          return {
            studentId: student.studentId,
            firstName: student.user?.firstName || '',
            lastName: student.user?.lastName || '',
            rollNumber: student.rollNumber,
            profilePhotoUrl: student.user?.profilePhotoUrl,
            marksObtained: existing?.marksObtained ?? '',
            remarks: existing?.remarks || '',
            isLocked: existing?.isLocked || false,
          };
        })
      );
    }
  }, [studentsData, existingMarks]);

  const handleMarksChange = (studentId: string, value: string) => {
    const numValue = value === '' ? '' : parseInt(value, 10);
    if (numValue !== '' && (numValue < 0 || numValue > (exam?.maxMarks || 100))) return;

    setStudentMarks((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, marksObtained: numValue } : s))
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setStudentMarks((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  };

  const handleSave = async () => {
    const validMarks = studentMarks.filter((s) => s.marksObtained !== '' && !s.isLocked);

    if (validMarks.length === 0) {
      enqueueSnackbar('No marks to save', { variant: 'warning' });
      return;
    }

    try {
      await enterMarksBulk({
        examId: examId!,
        marks: validMarks.map((s) => ({
          studentId: s.studentId,
          marksObtained: s.marksObtained as number,
          remarks: s.remarks || undefined,
        })),
      }).unwrap();
      enqueueSnackbar('Marks saved successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to save marks', { variant: 'error' });
    }
  };

  const handleLockMarks = async () => {
    try {
      await lockMarks(examId!).unwrap();
      enqueueSnackbar('Marks locked successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to lock marks', { variant: 'error' });
    }
  };

  const getGrade = (marks: number | '', maxMarks: number) => {
    if (marks === '') return '-';
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 35) return 'D';
    return 'F';
  };

  const isLoading = examLoading || studentsLoading || marksLoading;
  const summary = summaryData?.data;
  const anyLocked = studentMarks.some((s) => s.isLocked);

  return (
    <Box>
      <PageHeader
        title={`Enter Marks - ${exam?.name || ''}`}
        subtitle={exam ? `${exam.subjectName} | Max: ${exam.maxMarks} | Pass: ${exam.passingMarks}` : ''}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Exams', path: '/exams' },
          { label: 'Enter Marks' },
        ]}
      />

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Class</InputLabel>
                <Select
                  value={selectedClass}
                  label="Class"
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSection('');
                  }}
                >
                  {examClasses.map((cls) => (
                    <MenuItem key={cls.classId} value={cls.classId}>
                      {cls.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small" disabled={!selectedClass}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={selectedSection}
                  label="Section"
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  {sections.map((section) => (
                    <MenuItem key={section.sectionId} value={section.sectionId}>
                      {section.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<BackIcon />}
                  onClick={() => navigate('/exams')}
                >
                  Back
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<LockIcon />}
                  onClick={handleLockMarks}
                  disabled={locking || !selectedSection || studentMarks.length === 0}
                >
                  Lock Marks
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving || !selectedSection || studentMarks.length === 0 || anyLocked}
                >
                  {saving ? <CircularProgress size={20} /> : 'Save Marks'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {selectedClass && selectedSection && (
        <>
          {/* Summary */}
          {summary && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h6">{summary.totalStudents}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h6" color="success.main">{summary.passed}</Typography>
                    <Typography variant="caption" color="text.secondary">Passed</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h6" color="error.main">{summary.failed}</Typography>
                    <Typography variant="caption" color="text.secondary">Failed</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h6">{summary.highestMarks}</Typography>
                    <Typography variant="caption" color="text.secondary">Highest</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h6">{summary.averageMarks?.toFixed(1)}</Typography>
                    <Typography variant="caption" color="text.secondary">Average</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="h6" color="primary.main">{summary.passPercentage?.toFixed(0)}%</Typography>
                    <Typography variant="caption" color="text.secondary">Pass %</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {anyLocked && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Marks for this section are locked and cannot be edited.
            </Alert>
          )}

          {/* Marks Table */}
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>Roll No</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell width={150}>Marks (/{exam?.maxMarks})</TableCell>
                    <TableCell width={80}>Grade</TableCell>
                    <TableCell width={80}>Status</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : studentMarks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        No students found
                      </TableCell>
                    </TableRow>
                  ) : (
                    studentMarks.map((student) => {
                      const isPassing = student.marksObtained !== '' && student.marksObtained >= (exam?.passingMarks || 0);
                      return (
                        <TableRow key={student.studentId}>
                          <TableCell>{student.rollNumber}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar src={student.profilePhotoUrl} sx={{ width: 32, height: 32 }}>
                                {student.firstName?.charAt(0)}
                              </Avatar>
                              <Typography variant="body2">
                                {student.firstName} {student.lastName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={student.marksObtained}
                              onChange={(e) => handleMarksChange(student.studentId, e.target.value)}
                              inputProps={{ min: 0, max: exam?.maxMarks, style: { width: 80 } }}
                              disabled={student.isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getGrade(student.marksObtained, exam?.maxMarks || 100)}
                              size="small"
                              color={student.marksObtained === '' ? 'default' : isPassing ? 'success' : 'error'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {student.marksObtained !== '' && (
                              <Chip
                                label={isPassing ? 'Pass' : 'Fail'}
                                size="small"
                                color={isPassing ? 'success' : 'error'}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              placeholder="Remarks..."
                              value={student.remarks}
                              onChange={(e) => handleRemarksChange(student.studentId, e.target.value)}
                              fullWidth
                              disabled={student.isLocked}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Box>
  );
};

export default EnterMarksPage;
