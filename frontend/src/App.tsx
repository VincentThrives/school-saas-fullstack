import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { SnackbarProvider } from 'notistack';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AnimatePresence } from 'framer-motion';

import { store, useAppSelector } from './store';
import { theme, darkTheme } from './theme';
import { selectIsDarkMode } from './store/slices/uiSlice';

// Layouts
import { MainLayout } from './layouts';

// Guards
import { AuthGuard, RoleGuard } from './guards';

// Auth Pages
import {
  SchoolIdPage,
  LoginPage,
  SuperAdminLoginPage,
  ForgotPasswordPage,
} from './features/auth';

// Dashboard
import { DashboardPage } from './features/dashboard';

// Core Modules
import { UsersListPage, UserFormPage } from './features/users';
import { StudentsListPage, StudentFormPage } from './features/students';
import { TeachersListPage, TeacherFormPage } from './features/teachers';
import { ClassesListPage, ClassFormPage } from './features/classes';
import { AcademicYearsListPage } from './features/academic-years';

// Academic Modules
import { MarkAttendancePage, AttendanceReportPage } from './features/attendance';
import { ExamsListPage, ExamFormPage, EnterMarksPage } from './features/exams';
import { McqExamsListPage, QuestionBankPage, TakeMcqExamPage, AvailableMcqExamsPage } from './features/mcq';

// WhatsApp
import { WhatsAppComposePage, WhatsAppHistoryPage, WhatsAppMessageDetailPage } from './features/whatsapp';

// Lazy load other pages
import { Suspense } from 'react';
import { Box, CircularProgress, Typography, alpha } from '@mui/material';
import { UserRole } from './types';
import { motion } from 'framer-motion';

const GOLD = '#D4A843';

// Loading component with gold spinner
const PageLoader = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      gap: 2,
    }}
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
    >
      <CircularProgress sx={{ color: GOLD }} size={48} />
    </motion.div>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <Typography variant="body2" color="text.secondary">
        Loading...
      </Typography>
    </motion.div>
  </Box>
);

// Placeholder pages with animations
const PlaceholderPage = ({ title }: { title: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Box
      sx={{
        p: 4,
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: alpha(GOLD, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            border: `2px solid ${alpha(GOLD, 0.2)}`,
          }}
        >
          <Typography variant="h3" sx={{ color: GOLD }}>
            {title.charAt(0)}
          </Typography>
        </Box>
      </motion.div>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 400 }}>
        This module is coming soon. We're building something great for you.
      </Typography>
    </Box>
  </motion.div>
);

// Theme wrapper that reads dark mode state
const ThemedApp = () => {
  const isDarkMode = useAppSelector(selectIsDarkMode);

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <BrowserRouter>
            <AnimatePresence mode="wait">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<SchoolIdPage />} />
                  <Route path="/login/credentials" element={<LoginPage />} />
                  <Route path="/superadmin" element={<SuperAdminLoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                  {/* Protected Routes */}
                  <Route
                    element={
                      <AuthGuard>
                        <MainLayout />
                      </AuthGuard>
                    }
                  >
                    {/* Dashboard */}
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/superadmin/dashboard" element={<DashboardPage />} />

                    {/* Users */}
                    <Route path="/users" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><UsersListPage /></RoleGuard>} />
                    <Route path="/users/new" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><UserFormPage /></RoleGuard>} />
                    <Route path="/users/:userId/edit" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><UserFormPage /></RoleGuard>} />

                    {/* Students */}
                    <Route path="/students" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><StudentsListPage /></RoleGuard>} />
                    <Route path="/students/new" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><StudentFormPage /></RoleGuard>} />
                    <Route path="/students/:studentId" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><PlaceholderPage title="Student Details" /></RoleGuard>} />
                    <Route path="/students/:studentId/edit" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><StudentFormPage /></RoleGuard>} />

                    {/* Teachers */}
                    <Route path="/teachers" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL]}><TeachersListPage /></RoleGuard>} />
                    <Route path="/teachers/new" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><TeacherFormPage /></RoleGuard>} />
                    <Route path="/teachers/:teacherId" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL]}><PlaceholderPage title="Teacher Details" /></RoleGuard>} />
                    <Route path="/teachers/:teacherId/edit" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><TeacherFormPage /></RoleGuard>} />

                    {/* Classes */}
                    <Route path="/classes" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><ClassesListPage /></RoleGuard>} />
                    <Route path="/classes/new" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><ClassFormPage /></RoleGuard>} />
                    <Route path="/classes/:classId/edit" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><ClassFormPage /></RoleGuard>} />

                    {/* Academic Years */}
                    <Route path="/academic-years" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}><AcademicYearsListPage /></RoleGuard>} />

                    {/* Attendance */}
                    <Route path="/attendance" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><MarkAttendancePage /></RoleGuard>} />
                    <Route path="/attendance/reports" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><AttendanceReportPage /></RoleGuard>} />
                    <Route path="/my-attendance" element={<PlaceholderPage title="My Attendance" />} />
                    <Route path="/child-attendance" element={<PlaceholderPage title="Child Attendance" />} />

                    {/* Timetable */}
                    <Route path="/timetable" element={<PlaceholderPage title="Timetable" />} />

                    {/* Exams */}
                    <Route path="/exams" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><ExamsListPage /></RoleGuard>} />
                    <Route path="/exams/new" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.TEACHER]}><ExamFormPage /></RoleGuard>} />
                    <Route path="/exams/:examId/edit" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.TEACHER]}><ExamFormPage /></RoleGuard>} />
                    <Route path="/exams/:examId/marks" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.TEACHER]}><EnterMarksPage /></RoleGuard>} />
                    <Route path="/my-marks" element={<PlaceholderPage title="My Marks" />} />
                    <Route path="/child-marks" element={<PlaceholderPage title="Child Marks" />} />

                    {/* MCQ */}
                    <Route path="/mcq" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.TEACHER]}><McqExamsListPage /></RoleGuard>} />
                    <Route path="/mcq/questions" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.TEACHER]}><QuestionBankPage /></RoleGuard>} />
                    <Route path="/mcq/available" element={<RoleGuard allowedRoles={[UserRole.STUDENT]}><AvailableMcqExamsPage /></RoleGuard>} />
                    <Route path="/mcq/take/:examId" element={<RoleGuard allowedRoles={[UserRole.STUDENT]}><TakeMcqExamPage /></RoleGuard>} />

                    {/* Fees */}
                    <Route path="/fees" element={<PlaceholderPage title="Fee Management" />} />
                    <Route path="/fee-status" element={<PlaceholderPage title="Fee Status" />} />

                    {/* Events */}
                    <Route path="/events" element={<PlaceholderPage title="Events" />} />

                    {/* Notifications */}
                    <Route path="/notifications" element={<PlaceholderPage title="Notifications" />} />

                    {/* Messages */}
                    <Route path="/messages" element={<PlaceholderPage title="Messages" />} />

                    {/* WhatsApp */}
                    <Route path="/whatsapp" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><WhatsAppHistoryPage /></RoleGuard>} />
                    <Route path="/whatsapp/compose" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><WhatsAppComposePage /></RoleGuard>} />
                    <Route path="/whatsapp/:messageId" element={<RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER]}><WhatsAppMessageDetailPage /></RoleGuard>} />

                    {/* Study Materials */}
                    <Route path="/study-materials" element={<PlaceholderPage title="Study Materials" />} />

                    {/* Teacher specific */}
                    <Route path="/my-classes" element={<PlaceholderPage title="My Classes" />} />
                    <Route path="/my-students" element={<PlaceholderPage title="My Students" />} />
                    <Route path="/mentoring" element={<PlaceholderPage title="Mentoring Notes" />} />

                    {/* Parent specific */}
                    <Route path="/children" element={<PlaceholderPage title="My Children" />} />

                    {/* Reports */}
                    <Route path="/reports" element={<PlaceholderPage title="Reports" />} />

                    {/* Settings */}
                    <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
                    <Route path="/profile" element={<PlaceholderPage title="Profile" />} />

                    {/* Super Admin Routes */}
                    <Route path="/superadmin/tenants" element={<RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}><PlaceholderPage title="Tenants" /></RoleGuard>} />
                    <Route path="/superadmin/features" element={<RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}><PlaceholderPage title="Feature Flags" /></RoleGuard>} />
                    <Route path="/superadmin/audit-logs" element={<RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}><PlaceholderPage title="Audit Logs" /></RoleGuard>} />
                    <Route path="/superadmin/settings" element={<RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}><PlaceholderPage title="Super Admin Settings" /></RoleGuard>} />
                  </Route>

                  {/* Redirects */}
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </AnimatePresence>
          </BrowserRouter>
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

function App() {
  return (
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  );
}

export default App;
