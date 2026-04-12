import { Box, Grid, Card, CardContent, CardHeader, Typography, Chip, LinearProgress, Avatar, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import {
  Business as TenantIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Storage as StorageIcon,
  TrendingUp,
  CheckCircle,
  Warning,
  Block,
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { StatCard } from '../../../components/common';
import { useGetGlobalStatsQuery, useGetTenantActivityQuery } from '../../../store/api/superAdminApi';

export const SuperAdminDashboard = () => {
  const { data: statsData, isLoading: statsLoading } = useGetGlobalStatsQuery();
  const { data: activityData } = useGetTenantActivityQuery({});

  const stats = statsData?.data;

  // Mock data for charts (will be replaced with real data)
  const tenantStatusData = [
    { id: 0, value: stats?.activeTenants || 45, label: 'Active', color: '#4caf50' },
    { id: 1, value: stats?.inactiveTenants || 8, label: 'Inactive', color: '#ff9800' },
    { id: 2, value: stats?.suspendedTenants || 2, label: 'Suspended', color: '#f44336' },
  ];

  const monthlyGrowthData = [
    { month: 'Jan', tenants: 35 },
    { month: 'Feb', tenants: 38 },
    { month: 'Mar', tenants: 42 },
    { month: 'Apr', tenants: 45 },
    { month: 'May', tenants: 50 },
    { month: 'Jun', tenants: 55 },
  ];

  const recentTenants = activityData?.data?.slice(0, 5) || [
    { tenantId: '1', schoolName: 'Greenwood Academy', lastLogin: '2 hours ago', activeUsers: 125 },
    { tenantId: '2', schoolName: 'St. Mary\'s School', lastLogin: '5 hours ago', activeUsers: 89 },
    { tenantId: '3', schoolName: 'Delhi Public School', lastLogin: '1 day ago', activeUsers: 210 },
    { tenantId: '4', schoolName: 'Cambridge International', lastLogin: '2 days ago', activeUsers: 156 },
    { tenantId: '5', schoolName: 'National Academy', lastLogin: '3 days ago', activeUsers: 78 },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
        Super Admin Dashboard
      </Typography>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Tenants"
            value={stats?.totalTenants || 55}
            icon={<TenantIcon />}
            color="primary"
            trend={{ value: 12, label: 'vs last month' }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Users"
            value={(stats?.totalUsers || 15420).toLocaleString()}
            icon={<PeopleIcon />}
            color="info"
            trend={{ value: 8 }}
            subtitle="across all tenants"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Students"
            value={(stats?.totalStudents || 12500).toLocaleString()}
            icon={<SchoolIcon />}
            color="success"
            trend={{ value: 5 }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Storage Used"
            value={`${stats?.totalStorageUsedGb || 256} GB`}
            icon={<StorageIcon />}
            color="warning"
            subtitle="of 1 TB total"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Tenant Status" />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart
                  series={[
                    {
                      data: tenantStatusData,
                      innerRadius: 50,
                      outerRadius: 90,
                      paddingAngle: 2,
                      cornerRadius: 4,
                      highlightScope: { fade: 'global', highlight: 'item' },
                    },
                  ]}
                  height={200}
                  width={250}
                                  />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                {tenantStatusData.map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: item.color,
                      }}
                    />
                    <Typography variant="caption">
                      {item.label}: {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Monthly Tenant Growth" />
            <CardContent>
              <BarChart
                xAxis={[{ scaleType: 'band', data: monthlyGrowthData.map((d) => d.month) }]}
                series={[{ data: monthlyGrowthData.map((d) => d.tenants), color: '#1976d2' }]}
                height={200}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity & Quick Stats */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="Recent Tenant Activity"
              action={
                <Chip
                  label="View All"
                  size="small"
                  clickable
                  component="a"
                  href="/superadmin/tenants"
                />
              }
            />
            <List>
              {recentTenants.map((tenant, index) => (
                <ListItem key={tenant.tenantId} divider={index < recentTenants.length - 1}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {tenant.schoolName.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={tenant.schoolName}
                    secondary={`Last active: ${tenant.lastLogin}`}
                  />
                  <Chip
                    label={`${tenant.activeUsers} users`}
                    size="small"
                    variant="outlined"
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title="System Health" />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">API Response Time</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    45ms avg
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={85}
                  color="success"
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Database Load</Typography>
                  <Typography variant="body2" fontWeight={600} color="warning.main">
                    62%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={62}
                  color="warning"
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Storage Capacity</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    256 GB / 1 TB
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={25.6}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Uptime</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    99.9%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={99.9}
                  color="success"
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SuperAdminDashboard;
