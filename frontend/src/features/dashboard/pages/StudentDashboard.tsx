import { Box, Grid, Card, CardContent, CardHeader, Typography, Chip, List, ListItem, ListItemText, ListItemIcon, Avatar, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import {
  Schedule as ScheduleIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamIcon,
  Quiz as McqIcon,
  Notifications as NotificationIcon,
  CheckCircle,
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from '../../../components/common';
import { useGetStudentDashboardQuery } from '../../../store/api/dashboardApi';
import { useGetTodayTimetableQuery } from '../../../store/api/dashboardApi';
import { useGetAvailableMcqExamsQuery } from '../../../store/api/mcqApi';

export const StudentDashboard = () => {
  const { data: dashboardData } = useGetStudentDashboardQuery();
  const { data: timetableData } = useGetTodayTimetableQuery();
  const { data: mcqExamsData } = useGetAvailableMcqExamsQuery();

  const stats = dashboardData?.data || {
    attendancePercentage: 92.5,
    recentMarks: [],
    upcomingMcqExams: [],
    unreadNotifications: 5,
  };

  // Mock data
  const todaySchedule = timetableData?.data || [
    { periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectName: 'Mathematics', teacherName: 'Mr. Smith', room: 'Room 101' },
    { periodNumber: 2, startTime: '08:45', endTime: '09:30', subjectName: 'Science', teacherName: 'Mrs. Johnson', room: 'Lab 1' },
    { periodNumber: 3, startTime: '09:45', endTime: '10:30', subjectName: 'English', teacherName: 'Ms. Williams', room: 'Room 102' },
    { periodNumber: 4, startTime: '10:30', endTime: '11:15', subjectName: 'History', teacherName: 'Mr. Brown', room: 'Room 103' },
    { periodNumber: 5, startTime: '11:30', endTime: '12:15', subjectName: 'Geography', teacherName: 'Mrs. Davis', room: 'Room 104' },
    { periodNumber: 6, startTime: '12:15', endTime: '13:00', subjectName: 'Physical Ed', teacherName: 'Mr. Wilson', room: 'Ground' },
  ];

  const recentMarks = [
    { exam: 'Math Unit Test', marks: 45, total: 50, grade: 'A' },
    { exam: 'Science Quiz', marks: 18, total: 20, grade: 'A' },
    { exam: 'English Essay', marks: 38, total: 50, grade: 'B+' },
  ];

  const upcomingMcqExams = mcqExamsData?.data || [
    { examId: '1', title: 'Math Chapter 5 Quiz', duration: 30, subjectName: 'Mathematics', endTime: '2024-03-15T18:00:00' },
    { examId: '2', title: 'Science MCQ Test', duration: 45, subjectName: 'Science', endTime: '2024-03-18T17:00:00' },
  ];

  const attendanceData = [
    { id: 0, value: 92.5, label: 'Present', color: '#4caf50' },
    { id: 1, value: 7.5, label: 'Absent', color: '#f44336' },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
        My Dashboard
      </Typography>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Attendance"
            value={`${stats.attendancePercentage}%`}
            icon={<AttendanceIcon />}
            color={stats.attendancePercentage >= 75 ? 'success' : 'warning'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today's Classes"
            value={todaySchedule.length}
            icon={<ScheduleIcon />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Available MCQ"
            value={upcomingMcqExams.length}
            icon={<McqIcon />}
            color="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Notifications"
            value={stats.unreadNotifications}
            icon={<NotificationIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Today's Timetable */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="Today's Timetable"
              avatar={<ScheduleIcon color="primary" />}
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Teacher</TableCell>
                    <TableCell>Room</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {todaySchedule.map((period, index) => (
                    <TableRow key={index}>
                      <TableCell>{period.periodNumber}</TableCell>
                      <TableCell>{`${period.startTime} - ${period.endTime}`}</TableCell>
                      <TableCell>{period.subjectName}</TableCell>
                      <TableCell>{period.teacherName}</TableCell>
                      <TableCell>{period.room}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Attendance Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Attendance Overview" />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart
                  series={[
                    {
                      data: attendanceData,
                      innerRadius: 50,
                      outerRadius: 80,
                      paddingAngle: 2,
                      cornerRadius: 4,
                    },
                  ]}
                  height={180}
                  width={200}
                                  />
              </Box>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {stats.attendancePercentage}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall Attendance
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Marks */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Recent Marks"
              avatar={<ExamIcon color="primary" />}
              action={
                <Chip
                  label="View All"
                  size="small"
                  clickable
                  component="a"
                  href="/my-marks"
                />
              }
            />
            <List>
              {recentMarks.map((exam, index) => (
                <ListItem key={index} divider={index < recentMarks.length - 1}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'primary.light', width: 36, height: 36 }}>
                      <ExamIcon fontSize="small" />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={exam.exam}
                    secondary={`${exam.marks}/${exam.total}`}
                  />
                  <Chip
                    label={exam.grade}
                    size="small"
                    color={exam.grade.startsWith('A') ? 'success' : 'primary'}
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>

        {/* MCQ Exams */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Available MCQ Exams"
              avatar={<McqIcon color="secondary" />}
              action={
                <Chip
                  label="View All"
                  size="small"
                  clickable
                  component="a"
                  href="/mcq/available"
                />
              }
            />
            <List>
              {upcomingMcqExams.map((exam, index) => (
                <ListItem key={exam.examId} divider={index < upcomingMcqExams.length - 1}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'secondary.light', width: 36, height: 36 }}>
                      <McqIcon fontSize="small" />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={exam.title}
                    secondary={`${exam.subjectName} • ${exam.duration} mins`}
                  />
                  <Chip
                    label="Start"
                    size="small"
                    color="primary"
                    clickable
                    component="a"
                    href={`/mcq/take/${exam.examId}`}
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudentDashboard;
