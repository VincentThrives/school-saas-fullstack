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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Typography,
  LinearProgress,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetClassesQuery } from '../../../store/api/classesApi';
import { useGetAttendanceQuery, useGetClassAttendanceSummaryQuery } from '../../../store/api/attendanceApi';
import { AttendanceStatus } from '../../../types';
import dayjs from 'dayjs';

export const AttendanceReportPage = () => {
  const dispatch = useAppDispatch();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: classesData } = useGetClassesQuery();
  const classes = classesData?.data || [];

  const selectedClassData = useMemo(
    () => classes.find((c) => c.classId === selectedClass),
    [classes, selectedClass]
  );
  const sections = selectedClassData?.sections || [];

  const { data: attendanceData, isLoading, refetch } = useGetAttendanceQuery(
    {
      classId: selectedClass,
      sectionId: selectedSection,
      startDate,
      endDate,
      size: 1000,
    },
    { skip: !selectedClass }
  );

  const { data: summaryData } = useGetClassAttendanceSummaryQuery(
    { classId: selectedClass, sectionId: selectedSection || undefined, date: endDate },
    { skip: !selectedClass }
  );

  useEffect(() => {
    dispatch(setPageTitle('Attendance Reports'));
  }, [dispatch]);

  const attendanceRecords = attendanceData?.data?.content || [];
  const summary = summaryData?.data;

  // Group attendance by student
  const studentAttendanceMap = useMemo(() => {
    const map = new Map<string, {
      studentId: string;
      studentName: string;
      rollNumber: string;
      profilePhotoUrl?: string;
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      total: number;
      percentage: number;
    }>();

    attendanceRecords.forEach((record) => {
      const existing = map.get(record.studentId) || {
        studentId: record.studentId,
        studentName: record.student ? `${record.student.user?.firstName} ${record.student.user?.lastName}` : 'Unknown',
        rollNumber: record.student?.rollNumber || '',
        profilePhotoUrl: record.student?.user?.profilePhotoUrl,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        total: 0,
        percentage: 0,
      };

      existing.total++;
      if (record.status === AttendanceStatus.PRESENT) existing.present++;
      else if (record.status === AttendanceStatus.ABSENT) existing.absent++;
      else if (record.status === AttendanceStatus.LATE) existing.late++;
      else if (record.status === AttendanceStatus.HALF_DAY) existing.halfDay++;

      existing.percentage = Math.round(((existing.present + existing.late * 0.5 + existing.halfDay * 0.5) / existing.total) * 100);

      map.set(record.studentId, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  }, [attendanceRecords]);

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 75) return 'primary';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <PageHeader
        title="Attendance Reports"
        subtitle="View and analyze attendance data"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Attendance', path: '/attendance' },
          { label: 'Reports' },
        ]}
      />

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
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

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <FormControl fullWidth size="small" disabled={!selectedClass}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={selectedSection}
                  label="Section"
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  <MenuItem value="">All Sections</MenuItem>
                  {sections.map((section) => (
                    <MenuItem key={section.sectionId} value={section.sectionId}>
                      {section.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <TextField
                fullWidth
                size="small"
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <TextField
                fullWidth
                size="small"
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Refresh">
                  <IconButton onClick={() => refetch()}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export">
                  <IconButton>
                    <ExportIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          {/* Summary Cards */}
          {summary && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main" fontWeight={700}>
                      {summary.present}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Present Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main" fontWeight={700}>
                      {summary.absent}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Absent Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main" fontWeight={700}>
                      {summary.late}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Late Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main" fontWeight={700}>
                      {summary.percentage}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overall Attendance
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Student-wise Report */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Student-wise Attendance ({startDate} to {endDate})
              </Typography>
            </CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Roll No</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell align="center">Present</TableCell>
                    <TableCell align="center">Absent</TableCell>
                    <TableCell align="center">Late</TableCell>
                    <TableCell align="center">Half Day</TableCell>
                    <TableCell align="center">Total Days</TableCell>
                    <TableCell>Attendance %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : studentAttendanceMap.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        No attendance records found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    studentAttendanceMap.map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell>{student.rollNumber}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar src={student.profilePhotoUrl} sx={{ width: 32, height: 32 }}>
                              {student.studentName.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{student.studentName}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={student.present} size="small" color="success" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={student.absent} size="small" color="error" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={student.late} size="small" color="warning" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={student.halfDay} size="small" color="info" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">{student.total}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={student.percentage}
                                color={getPercentageColor(student.percentage)}
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                            </Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color={`${getPercentageColor(student.percentage)}.main`}
                            >
                              {student.percentage}%
                            </Typography>
                          </Box>
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
    </Box>
  );
};

export default AttendanceReportPage;
