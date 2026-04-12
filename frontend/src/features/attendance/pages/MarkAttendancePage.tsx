import { useState, useEffect, useMemo } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as PresentIcon,
  Cancel as AbsentIcon,
  Schedule as LateIcon,
  HourglassBottom as HalfDayIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetClassesQuery } from '../../../store/api/classesApi';
import { useGetStudentsQuery } from '../../../store/api/studentsApi';
import { useGetAttendanceByDateAndClassQuery, useMarkAttendanceMutation } from '../../../store/api/attendanceApi';
import { AttendanceStatus } from '../../../types';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

interface StudentAttendance {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  profilePhotoUrl?: string;
  status: AttendanceStatus;
  remarks: string;
}

export const MarkAttendancePage = () => {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [studentAttendances, setStudentAttendances] = useState<StudentAttendance[]>([]);

  const { data: classesData } = useGetClassesQuery();
  const classes = classesData?.data || [];

  const selectedClassData = useMemo(
    () => classes.find((c) => c.classId === selectedClass),
    [classes, selectedClass]
  );
  const sections = selectedClassData?.sections || [];

  const { data: studentsData, isLoading: studentsLoading } = useGetStudentsQuery(
    { classId: selectedClass, sectionId: selectedSection, size: 100 },
    { skip: !selectedClass || !selectedSection }
  );

  const { data: existingAttendance, isLoading: attendanceLoading } = useGetAttendanceByDateAndClassQuery(
    { classId: selectedClass, sectionId: selectedSection, date: selectedDate },
    { skip: !selectedClass || !selectedSection }
  );

  const [markAttendance, { isLoading: saving }] = useMarkAttendanceMutation();

  useEffect(() => {
    dispatch(setPageTitle('Mark Attendance'));
  }, [dispatch]);

  useEffect(() => {
    if (studentsData?.data?.content) {
      const students = studentsData.data.content;
      const existingMap = new Map(
        existingAttendance?.data?.map((a) => [a.studentId, a]) || []
      );

      setStudentAttendances(
        students.map((student) => {
          const existing = existingMap.get(student.studentId);
          return {
            studentId: student.studentId,
            firstName: student.user?.firstName || '',
            lastName: student.user?.lastName || '',
            rollNumber: student.rollNumber,
            profilePhotoUrl: student.user?.profilePhotoUrl,
            status: existing?.status || AttendanceStatus.PRESENT,
            remarks: existing?.remarks || '',
          };
        })
      );
    }
  }, [studentsData, existingAttendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudentAttendances((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setStudentAttendances((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setStudentAttendances((prev) => prev.map((s) => ({ ...s, status })));
  };

  const handleSave = async () => {
    try {
      await markAttendance({
        classId: selectedClass,
        sectionId: selectedSection,
        date: selectedDate,
        attendances: studentAttendances.map((s) => ({
          studentId: s.studentId,
          status: s.status,
          remarks: s.remarks || undefined,
        })),
      }).unwrap();
      enqueueSnackbar('Attendance saved successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to save attendance', { variant: 'error' });
    }
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'success';
      case AttendanceStatus.ABSENT:
        return 'error';
      case AttendanceStatus.LATE:
        return 'warning';
      case AttendanceStatus.HALF_DAY:
        return 'info';
      default:
        return 'default';
    }
  };

  const summary = useMemo(() => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
    };
    studentAttendances.forEach((s) => {
      if (s.status === AttendanceStatus.PRESENT) counts.present++;
      else if (s.status === AttendanceStatus.ABSENT) counts.absent++;
      else if (s.status === AttendanceStatus.LATE) counts.late++;
      else if (s.status === AttendanceStatus.HALF_DAY) counts.halfDay++;
    });
    return counts;
  }, [studentAttendances]);

  const isLoading = studentsLoading || attendanceLoading;

  return (
    <Box>
      <PageHeader
        title="Mark Attendance"
        subtitle="Record daily attendance for students"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Attendance', path: '/attendance' },
          { label: 'Mark Attendance' },
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
                  {classes.map((cls) => (
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

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                label="Date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: dayjs().format('YYYY-MM-DD') }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={!selectedClass || !selectedSection || saving || studentAttendances.length === 0}
                fullWidth
              >
                {saving ? <CircularProgress size={20} /> : 'Save Attendance'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {selectedClass && selectedSection && (
        <>
          {/* Quick Actions & Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      onClick={() => handleMarkAll(AttendanceStatus.PRESENT)}
                    >
                      Mark All Present
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleMarkAll(AttendanceStatus.ABSENT)}
                    >
                      Mark All Absent
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Chip icon={<PresentIcon />} label={`Present: ${summary.present}`} color="success" variant="outlined" />
                  <Chip icon={<AbsentIcon />} label={`Absent: ${summary.absent}`} color="error" variant="outlined" />
                  <Chip icon={<LateIcon />} label={`Late: ${summary.late}`} color="warning" variant="outlined" />
                  <Chip icon={<HalfDayIcon />} label={`Half Day: ${summary.halfDay}`} color="info" variant="outlined" />
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>Roll No</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell width={300}>Status</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : studentAttendances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        No students found in this class/section
                      </TableCell>
                    </TableRow>
                  ) : (
                    studentAttendances.map((student) => (
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
                          <ToggleButtonGroup
                            value={student.status}
                            exclusive
                            onChange={(_, value) => value && handleStatusChange(student.studentId, value)}
                            size="small"
                          >
                            <ToggleButton value={AttendanceStatus.PRESENT} color="success">
                              <PresentIcon fontSize="small" sx={{ mr: 0.5 }} />
                              Present
                            </ToggleButton>
                            <ToggleButton value={AttendanceStatus.ABSENT} color="error">
                              <AbsentIcon fontSize="small" sx={{ mr: 0.5 }} />
                              Absent
                            </ToggleButton>
                            <ToggleButton value={AttendanceStatus.LATE} color="warning">
                              <LateIcon fontSize="small" sx={{ mr: 0.5 }} />
                              Late
                            </ToggleButton>
                            <ToggleButton value={AttendanceStatus.HALF_DAY} color="info">
                              <HalfDayIcon fontSize="small" sx={{ mr: 0.5 }} />
                              Half
                            </ToggleButton>
                          </ToggleButtonGroup>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Add remarks..."
                            value={student.remarks}
                            onChange={(e) => handleRemarksChange(student.studentId, e.target.value)}
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {!selectedClass && (
        <Alert severity="info">Please select a class and section to mark attendance.</Alert>
      )}
    </Box>
  );
};

export default MarkAttendancePage;
