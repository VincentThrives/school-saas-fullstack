import { Box, Grid, Card, CardContent, CardHeader, Typography, Chip, List, ListItem, ListItemText, ListItemIcon, Avatar, LinearProgress, alpha } from '@mui/material';
import {
  People as PeopleIcon,
  School as SchoolIcon,
  Person as TeacherIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamIcon,
  Payment as FeeIcon,
  Notifications as NotificationIcon,
  Event as EventIcon,
  TrendingUp,
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { motion } from 'framer-motion';
import { StatCard } from '../../../components/common';
import { useGetSchoolAdminDashboardQuery } from '../../../store/api/dashboardApi';
import { useGetUpcomingExamsQuery } from '../../../store/api/examsApi';
import { useGetUpcomingEventsQuery } from '../../../store/api/eventsApi';

const GOLD = '#D4A843';

export const SchoolAdminDashboard = () => {
  const { data: dashboardData, isLoading } = useGetSchoolAdminDashboardQuery();
  const { data: examsData } = useGetUpcomingExamsQuery({ days: 14 });
  const { data: eventsData } = useGetUpcomingEventsQuery({ days: 7 });

  const stats = dashboardData?.data || {
    totalStudents: 1250,
    totalTeachers: 65,
    totalClasses: 24,
    attendanceRateToday: 92.5,
    upcomingExams: 5,
    feeCollectionThisMonth: 450000,
    pendingFees: 125000,
    recentNotifications: 12,
  };

  // Mock data for charts
  const attendanceTrendData = [
    { day: 'Mon', rate: 95 },
    { day: 'Tue', rate: 92 },
    { day: 'Wed', rate: 94 },
    { day: 'Thu', rate: 91 },
    { day: 'Fri', rate: 93 },
  ];

  const feeStatusData = [
    { id: 0, value: 78, label: 'Collected', color: GOLD },
    { id: 1, value: 22, label: 'Pending', color: '#1A1A1A' },
  ];

  const upcomingExams = examsData?.data || [
    { examId: '1', name: 'Mid-Term Math', date: '2024-03-15', subjectName: 'Mathematics' },
    { examId: '2', name: 'Science Test', date: '2024-03-18', subjectName: 'Science' },
    { examId: '3', name: 'English Exam', date: '2024-03-20', subjectName: 'English' },
  ];

  const upcomingEvents = eventsData?.data || [
    { eventId: '1', title: 'Parent-Teacher Meeting', startDate: '2024-03-16', type: 'ACADEMIC' },
    { eventId: '2', title: 'Sports Day', startDate: '2024-03-22', type: 'SPORTS' },
    { eventId: '3', title: 'Annual Function', startDate: '2024-03-28', type: 'CULTURAL' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Box>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
          School Dashboard
        </Typography>

        {/* Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total Students"
              value={stats.totalStudents.toLocaleString()}
              icon={<SchoolIcon />}
              color="primary"
              trend={{ value: 5 }}
              subtitle="vs last year"
              delay={0}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total Teachers"
              value={stats.totalTeachers}
              icon={<TeacherIcon />}
              color="info"
              delay={1}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Today's Attendance"
              value={`${stats.attendanceRateToday}%`}
              icon={<AttendanceIcon />}
              color="success"
              subtitle={`${Math.round(stats.totalStudents * stats.attendanceRateToday / 100)} present`}
              delay={2}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Fee Collection"
              value={`₹${(stats.feeCollectionThisMonth / 100000).toFixed(1)}L`}
              icon={<FeeIcon />}
              color="warning"
              subtitle="this month"
              delay={3}
            />
          </Grid>
        </Grid>

        {/* Charts and Lists Row */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title="Weekly Attendance Trend"
                sx={{ borderBottom: `1px solid ${alpha(GOLD, 0.2)}` }}
              />
              <CardContent>
                <LineChart
                  xAxis={[{ scaleType: 'point', data: attendanceTrendData.map((d) => d.day) }]}
                  series={[
                    {
                      data: attendanceTrendData.map((d) => d.rate),
                      area: true,
                      color: '#B8860B',
                    },
                  ]}
                  height={250}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title="Fee Collection Status"
                sx={{ borderBottom: `1px solid ${alpha(GOLD, 0.2)}` }}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <PieChart
                    series={[
                      {
                        data: feeStatusData,
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: GOLD }} />
                      <Typography variant="body2">Collected</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      ₹{(stats.feeCollectionThisMonth / 1000).toFixed(0)}K
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1A1A1A' }} />
                      <Typography variant="body2">Pending</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      ₹{(stats.pendingFees / 1000).toFixed(0)}K
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Upcoming Items Row */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
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
                    sx={{
                      bgcolor: alpha(GOLD, 0.1),
                      color: GOLD,
                      fontWeight: 600,
                      '&:hover': { bgcolor: alpha(GOLD, 0.2) },
                    }}
                  />
                }
                sx={{ borderBottom: `1px solid ${alpha(GOLD, 0.2)}` }}
              />
              <List>
                {upcomingExams.slice(0, 4).map((exam, index) => (
                  <ListItem key={exam.examId} divider={index < upcomingExams.length - 1}>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: alpha(GOLD, 0.1), color: GOLD, width: 36, height: 36 }}>
                        <ExamIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={exam.name}
                      secondary={`${exam.subjectName} • ${new Date(exam.date).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title="Upcoming Events"
                avatar={<EventIcon color="secondary" />}
                action={
                  <Chip
                    label="View All"
                    size="small"
                    clickable
                    component="a"
                    href="/events"
                    sx={{
                      bgcolor: alpha(GOLD, 0.1),
                      color: GOLD,
                      fontWeight: 600,
                      '&:hover': { bgcolor: alpha(GOLD, 0.2) },
                    }}
                  />
                }
                sx={{ borderBottom: `1px solid ${alpha(GOLD, 0.2)}` }}
              />
              <List>
                {upcomingEvents.slice(0, 4).map((event, index) => (
                  <ListItem key={event.eventId} divider={index < upcomingEvents.length - 1}>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: alpha(GOLD, 0.1), color: GOLD, width: 36, height: 36 }}>
                        <EventIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={event.title}
                      secondary={new Date(event.startDate).toLocaleDateString()}
                    />
                    <Chip label={event.type} size="small" variant="outlined" />
                  </ListItem>
                ))}
              </List>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </motion.div>
  );
};

export default SchoolAdminDashboard;
