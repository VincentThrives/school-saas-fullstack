import { Box, Grid, Card, CardContent, CardHeader, Typography, Chip, List, ListItem, ListItemText, ListItemAvatar, Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  School as SchoolIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamIcon,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { BarChart } from '@mui/x-charts/BarChart';
import { StatCard } from '../../../components/common';
import { useGetPrincipalDashboardQuery } from '../../../store/api/dashboardApi';

export const PrincipalDashboard = () => {
  const { data: dashboardData } = useGetPrincipalDashboardQuery();

  const stats = dashboardData?.data || {
    attendanceRateToday: 94.2,
    attendanceRateMonth: 92.8,
    feeCollectionRate: 78,
    teacherComplianceRate: 96,
  };

  // Mock data
  const classWiseAttendance = [
    { class: 'Grade 10', attendance: 96 },
    { class: 'Grade 9', attendance: 94 },
    { class: 'Grade 8', attendance: 93 },
    { class: 'Grade 7', attendance: 91 },
    { class: 'Grade 6', attendance: 95 },
  ];

  const topPerformers = [
    { name: 'Rahul Sharma', class: '10-A', percentage: 98.5 },
    { name: 'Priya Singh', class: '10-B', percentage: 97.2 },
    { name: 'Amit Kumar', class: '9-A', percentage: 96.8 },
    { name: 'Sneha Patel', class: '10-A', percentage: 96.5 },
    { name: 'Vikram Reddy', class: '9-B', percentage: 95.9 },
  ];

  const lowPerformers = [
    { name: 'Student A', class: '8-B', percentage: 42.5, attendance: 65 },
    { name: 'Student B', class: '7-A', percentage: 45.2, attendance: 72 },
    { name: 'Student C', class: '9-C', percentage: 48.8, attendance: 68 },
  ];

  const upcomingExams = [
    { name: 'Final Exams - Grade 10', date: '2024-03-25', classes: 4 },
    { name: 'Unit Test - Grade 9', date: '2024-03-20', classes: 3 },
    { name: 'Mid-Term - Grade 8', date: '2024-03-22', classes: 3 },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
        Principal Dashboard
      </Typography>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today's Attendance"
            value={`${stats.attendanceRateToday}%`}
            icon={<AttendanceIcon />}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Monthly Attendance"
            value={`${stats.attendanceRateMonth}%`}
            icon={<AttendanceIcon />}
            color="info"
            trend={{ value: 2.5 }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Fee Collection"
            value={`${stats.feeCollectionRate}%`}
            icon={<CheckCircle />}
            color="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Teacher Compliance"
            value={`${stats.teacherComplianceRate}%`}
            icon={<CheckCircle />}
            color="primary"
            subtitle="attendance marking"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title="Class-wise Attendance" />
            <CardContent>
              <BarChart
                xAxis={[{ scaleType: 'band', data: classWiseAttendance.map((d) => d.class) }]}
                series={[
                  {
                    data: classWiseAttendance.map((d) => d.attendance),
                    color: '#4caf50',
                  },
                ]}
                height={300}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Upcoming Exams" />
            <List>
              {upcomingExams.map((exam, index) => (
                <ListItem key={index} divider={index < upcomingExams.length - 1}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <ExamIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={exam.name}
                    secondary={`${exam.date} • ${exam.classes} classes`}
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Tables */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Top Performers"
              avatar={<TrendingUp color="success" />}
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topPerformers.map((student, index) => (
                    <TableRow key={index}>
                      <TableCell>#{index + 1}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.class}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${student.percentage}%`}
                          size="small"
                          color="success"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Students Needing Attention"
              avatar={<Warning color="warning" />}
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell align="right">Marks %</TableCell>
                    <TableCell align="right">Attendance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowPerformers.map((student, index) => (
                    <TableRow key={index}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.class}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${student.percentage}%`}
                          size="small"
                          color="error"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${student.attendance}%`}
                          size="small"
                          color="warning"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PrincipalDashboard;
