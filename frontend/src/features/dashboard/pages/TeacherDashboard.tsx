import { Box, Grid, Card, CardContent, CardHeader, Typography, Chip, List, ListItem, ListItemText, ListItemIcon, Avatar, Alert, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import {
  Class as ClassIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamIcon,
  Schedule as ScheduleIcon,
  Warning,
  CheckCircle,
  School as StudentIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { StatCard } from '../../../components/common';
import { useGetTeacherDashboardQuery } from '../../../store/api/dashboardApi';
import { useGetTodayTimetableQuery } from '../../../store/api/dashboardApi';
import { Link as RouterLink } from 'react-router-dom';

export const TeacherDashboard = () => {
  const { data: dashboardData } = useGetTeacherDashboardQuery();
  const { data: timetableData } = useGetTodayTimetableQuery();

  const stats = dashboardData?.data || {
    assignedClasses: 4,
    assignedStudents: 120,
    pendingAttendance: true,
    upcomingExams: [],
    recentMessages: 3,
  };

  // Mock timetable data
  const todaySchedule = timetableData?.data || [
    { periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectName: 'Mathematics', className: 'Grade 10', sectionName: 'A', room: 'Room 101' },
    { periodNumber: 2, startTime: '08:45', endTime: '09:30', subjectName: 'Mathematics', className: 'Grade 9', sectionName: 'B', room: 'Room 102' },
    { periodNumber: 3, startTime: '09:45', endTime: '10:30', subjectName: 'Mathematics', className: 'Grade 10', sectionName: 'B', room: 'Room 101' },
    { periodNumber: 4, startTime: '10:30', endTime: '11:15', subjectName: 'Mathematics', className: 'Grade 8', sectionName: 'A', room: 'Room 103' },
    { periodNumber: 6, startTime: '12:00', endTime: '12:45', subjectName: 'Mathematics', className: 'Grade 9', sectionName: 'A', room: 'Room 102' },
  ];

  const upcomingExams = [
    { name: 'Mid-Term Test', class: 'Grade 10-A', date: '2024-03-15', subject: 'Mathematics' },
    { name: 'Unit Test 2', class: 'Grade 9-B', date: '2024-03-18', subject: 'Mathematics' },
  ];

  const classesNeedingAttendance = [
    { className: 'Grade 10', sectionName: 'A', period: '1st Period' },
    { className: 'Grade 9', sectionName: 'B', period: '2nd Period' },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
        Teacher Dashboard
      </Typography>

      {/* Attendance Alert */}
      {stats.pendingAttendance && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              component={RouterLink}
              to="/attendance"
            >
              Mark Now
            </Button>
          }
        >
          You have pending attendance for today. Please mark attendance for your classes.
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="My Classes"
            value={stats.assignedClasses}
            icon={<ClassIcon />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Students"
            value={stats.assignedStudents}
            icon={<StudentIcon />}
            color="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today's Periods"
            value={todaySchedule.length}
            icon={<ScheduleIcon />}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Unread Messages"
            value={stats.recentMessages}
            icon={<MessageIcon />}
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
              title="Today's Schedule"
              avatar={<ScheduleIcon color="primary" />}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Room</TableCell>
                    <TableCell>Attendance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {todaySchedule.map((period, index) => (
                    <TableRow key={index}>
                      <TableCell>{period.periodNumber}</TableCell>
                      <TableCell>{`${period.startTime} - ${period.endTime}`}</TableCell>
                      <TableCell>{`${period.className}-${period.sectionName}`}</TableCell>
                      <TableCell>{period.subjectName}</TableCell>
                      <TableCell>{period.room}</TableCell>
                      <TableCell>
                        <Chip
                          icon={<CheckCircle fontSize="small" />}
                          label="Marked"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Pending Attendance */}
          {classesNeedingAttendance.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardHeader
                title="Pending Attendance"
                avatar={<Warning color="warning" />}
              />
              <List>
                {classesNeedingAttendance.map((cls, index) => (
                  <ListItem
                    key={index}
                    divider={index < classesNeedingAttendance.length - 1}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="contained"
                        component={RouterLink}
                        to={`/attendance/mark?class=${cls.className}&section=${cls.sectionName}`}
                      >
                        Mark
                      </Button>
                    }
                  >
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: 'warning.light', width: 36, height: 36 }}>
                        <AttendanceIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={`${cls.className}-${cls.sectionName}`}
                      secondary={cls.period}
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}

          {/* Upcoming Exams */}
          <Card>
            <CardHeader
              title="Upcoming Exams"
              avatar={<ExamIcon color="primary" />}
              action={
                <Chip
                  label="View All"
                  size="small"
                  clickable
                  component="a"
                  href="/exams"
                />
              }
            />
            <List>
              {upcomingExams.map((exam, index) => (
                <ListItem key={index} divider={index < upcomingExams.length - 1}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'primary.light', width: 36, height: 36 }}>
                      <ExamIcon fontSize="small" />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={exam.name}
                    secondary={`${exam.class} • ${exam.date}`}
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

export default TeacherDashboard;
