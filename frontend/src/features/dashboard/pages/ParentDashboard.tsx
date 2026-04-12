import { Box, Grid, Card, CardContent, CardHeader, Typography, Chip, List, ListItem, ListItemText, ListItemIcon, Avatar, Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, Button } from '@mui/material';
import {
  EventNote as AttendanceIcon,
  Assignment as ExamIcon,
  Payment as FeeIcon,
  Event as EventIcon,
  Notifications as NotificationIcon,
  Person as ChildIcon,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from '../../../components/common';
import { useGetParentDashboardQuery } from '../../../store/api/dashboardApi';
import { Link as RouterLink } from 'react-router-dom';

export const ParentDashboard = () => {
  const [selectedChild, setSelectedChild] = useState('child1');
  const { data: dashboardData } = useGetParentDashboardQuery();

  // Mock children data
  const children = [
    { id: 'child1', name: 'Rahul Sharma', class: '10-A' },
    { id: 'child2', name: 'Priya Sharma', class: '8-B' },
  ];

  const stats = dashboardData?.data || {
    childAttendance: { percentage: 94.5, presentDays: 85, absentDays: 5, totalDays: 90 },
    recentMarks: [],
    feeStatus: { totalDue: 25000, totalPaid: 20000, outstanding: 5000 },
    schoolAnnouncements: [],
  };

  const recentMarks = [
    { exam: 'Mid-Term Math', marks: 45, total: 50, grade: 'A', date: '2024-03-10' },
    { exam: 'Science Quiz', marks: 18, total: 20, grade: 'A', date: '2024-03-08' },
    { exam: 'English Essay', marks: 38, total: 50, grade: 'B+', date: '2024-03-05' },
  ];

  const upcomingEvents = [
    { title: 'Parent-Teacher Meeting', date: '2024-03-16', type: 'ACADEMIC' },
    { title: 'Sports Day', date: '2024-03-22', type: 'SPORTS' },
    { title: 'Annual Function', date: '2024-03-28', type: 'CULTURAL' },
  ];

  const attendanceData = [
    { id: 0, value: 94.5, label: 'Present', color: '#4caf50' },
    { id: 1, value: 5.5, label: 'Absent', color: '#f44336' },
  ];

  const hasPendingFees = stats.feeStatus.outstanding > 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Parent Dashboard
        </Typography>

        {/* Child Selector */}
        {children.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Child</InputLabel>
            <Select
              value={selectedChild}
              label="Select Child"
              onChange={(e) => setSelectedChild(e.target.value)}
            >
              {children.map((child) => (
                <MenuItem key={child.id} value={child.id}>
                  {child.name} ({child.class})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Fee Alert */}
      {hasPendingFees && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              component={RouterLink}
              to="/fee-status"
            >
              View Details
            </Button>
          }
        >
          You have pending fee dues of ₹{stats.feeStatus.outstanding.toLocaleString()}. Please clear them to avoid late fees.
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Child's Attendance"
            value={`${stats.childAttendance.percentage}%`}
            icon={<AttendanceIcon />}
            color={stats.childAttendance.percentage >= 75 ? 'success' : 'warning'}
            subtitle={`${stats.childAttendance.presentDays}/${stats.childAttendance.totalDays} days`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Fee Paid"
            value={`₹${(stats.feeStatus.totalPaid / 1000).toFixed(0)}K`}
            icon={<CheckCircle />}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Fee Due"
            value={`₹${(stats.feeStatus.outstanding / 1000).toFixed(0)}K`}
            icon={<FeeIcon />}
            color={hasPendingFees ? 'warning' : 'success'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Notifications"
            value={5}
            icon={<NotificationIcon />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Attendance Overview */}
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
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Present Days</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {stats.childAttendance.presentDays}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Absent Days</Typography>
                  <Typography variant="body2" fontWeight={600} color="error.main">
                    {stats.childAttendance.absentDays}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total School Days</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {stats.childAttendance.totalDays}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Marks */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="Recent Exam Marks"
              avatar={<ExamIcon color="primary" />}
              action={
                <Chip
                  label="View All"
                  size="small"
                  clickable
                  component="a"
                  href="/child-marks"
                />
              }
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Exam</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Marks</TableCell>
                    <TableCell align="center">Grade</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentMarks.map((exam, index) => (
                    <TableRow key={index}>
                      <TableCell>{exam.exam}</TableCell>
                      <TableCell>{exam.date}</TableCell>
                      <TableCell align="center">{`${exam.marks}/${exam.total}`}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={exam.grade}
                          size="small"
                          color={exam.grade.startsWith('A') ? 'success' : 'primary'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Upcoming Events */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Upcoming Events"
              avatar={<EventIcon color="secondary" />}
            />
            <List>
              {upcomingEvents.map((event, index) => (
                <ListItem key={index} divider={index < upcomingEvents.length - 1}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'secondary.light', width: 36, height: 36 }}>
                      <EventIcon fontSize="small" />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={event.title}
                    secondary={event.date}
                  />
                  <Chip label={event.type} size="small" variant="outlined" />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>

        {/* Fee Summary */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Fee Summary"
              avatar={<FeeIcon color="warning" />}
              action={
                <Chip
                  label="View Details"
                  size="small"
                  clickable
                  component="a"
                  href="/fee-status"
                />
              }
            />
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Total Due</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    ₹{stats.feeStatus.totalDue.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1" color="success.main">Paid</Typography>
                  <Typography variant="body1" fontWeight={600} color="success.main">
                    ₹{stats.feeStatus.totalPaid.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body1" color="error.main">Outstanding</Typography>
                  <Typography variant="body1" fontWeight={600} color="error.main">
                    ₹{stats.feeStatus.outstanding.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              {hasPendingFees && (
                <Button
                  variant="contained"
                  fullWidth
                  component={RouterLink}
                  to="/fee-status"
                >
                  Pay Now
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ParentDashboard;
