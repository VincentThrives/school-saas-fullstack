import { http, HttpResponse, delay } from 'msw';
import { mockDashboardStats, mockEvents, mockExams, mockNotifications } from '../data/mockData';

const API_BASE = '/api/v1';

const apiResponse = <T>(data: T, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const dashboardHandlers = [
  // Super Admin Dashboard
  http.get(`${API_BASE}/super/dashboard`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.superAdmin));
  }),

  // School Admin Dashboard
  http.get(`${API_BASE}/dashboard/school-admin`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.schoolAdmin));
  }),

  // Principal Dashboard
  http.get(`${API_BASE}/dashboard/principal`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.principal));
  }),

  // Teacher Dashboard
  http.get(`${API_BASE}/dashboard/teacher`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.teacher));
  }),

  // Student Dashboard
  http.get(`${API_BASE}/dashboard/student`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.student));
  }),

  // Parent Dashboard
  http.get(`${API_BASE}/dashboard/parent`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.parent));
  }),

  // Today's Timetable
  http.get(`${API_BASE}/timetable/today`, async () => {
    await delay(300);
    return HttpResponse.json(
      apiResponse([
        { entryId: '1', periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectName: 'Mathematics', teacherName: 'Mr. Brown', className: 'Grade 10', sectionName: 'A', room: 'Room 101' },
        { entryId: '2', periodNumber: 2, startTime: '08:45', endTime: '09:30', subjectName: 'Science', teacherName: 'Mrs. Johnson', className: 'Grade 10', sectionName: 'A', room: 'Lab 1' },
        { entryId: '3', periodNumber: 3, startTime: '09:45', endTime: '10:30', subjectName: 'English', teacherName: 'Ms. Williams', className: 'Grade 10', sectionName: 'A', room: 'Room 102' },
        { entryId: '4', periodNumber: 4, startTime: '10:30', endTime: '11:15', subjectName: 'History', teacherName: 'Mr. Davis', className: 'Grade 10', sectionName: 'A', room: 'Room 103' },
        { entryId: '5', periodNumber: 5, startTime: '11:30', endTime: '12:15', subjectName: 'Geography', teacherName: 'Mrs. Smith', className: 'Grade 10', sectionName: 'A', room: 'Room 104' },
        { entryId: '6', periodNumber: 6, startTime: '12:15', endTime: '13:00', subjectName: 'Physical Ed', teacherName: 'Mr. Wilson', className: 'Grade 10', sectionName: 'A', room: 'Ground' },
      ])
    );
  }),

  // My Timetable
  http.get(`${API_BASE}/timetable/me`, async () => {
    await delay(300);
    return HttpResponse.json(
      apiResponse([
        { entryId: '1', periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectName: 'Mathematics', className: 'Grade 10', sectionName: 'A', room: 'Room 101' },
        { entryId: '2', periodNumber: 2, startTime: '08:45', endTime: '09:30', subjectName: 'Mathematics', className: 'Grade 9', sectionName: 'B', room: 'Room 102' },
        { entryId: '3', periodNumber: 3, startTime: '09:45', endTime: '10:30', subjectName: 'Mathematics', className: 'Grade 10', sectionName: 'B', room: 'Room 101' },
      ])
    );
  }),

  // Upcoming exams
  http.get(`${API_BASE}/exams/upcoming`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockExams));
  }),

  // Upcoming events
  http.get(`${API_BASE}/events/upcoming`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockEvents));
  }),

  // Notifications
  http.get(`${API_BASE}/notifications`, async () => {
    await delay(300);
    return HttpResponse.json(
      apiResponse({
        content: mockNotifications,
        totalElements: mockNotifications.length,
        totalPages: 1,
        page: 0,
        size: 10,
      })
    );
  }),

  // Unread notification count
  http.get(`${API_BASE}/notifications/unread-count`, async () => {
    await delay(200);
    return HttpResponse.json(apiResponse({ count: 5 }));
  }),

  // MCQ available exams
  http.get(`${API_BASE}/mcq/exams/available`, async () => {
    await delay(300);
    return HttpResponse.json(
      apiResponse([
        { examId: '1', title: 'Math Chapter 5 Quiz', duration: 30, subjectName: 'Mathematics', endTime: '2024-03-15T18:00:00' },
        { examId: '2', title: 'Science MCQ Test', duration: 45, subjectName: 'Science', endTime: '2024-03-18T17:00:00' },
      ])
    );
  }),

  // Global stats for super admin
  http.get(`${API_BASE}/super/tenants/stats`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockDashboardStats.superAdmin));
  }),

  // Tenant activity
  http.get(`${API_BASE}/super/tenants/activity`, async () => {
    await delay(500);
    return HttpResponse.json(
      apiResponse([
        { tenantId: '1', schoolName: 'Greenwood Academy', lastLogin: '2 hours ago', lastDataWrite: '1 hour ago', activeUsers: 125, storageUsedGb: 5.2 },
        { tenantId: '2', schoolName: "St. Mary's School", lastLogin: '5 hours ago', lastDataWrite: '3 hours ago', activeUsers: 89, storageUsedGb: 3.8 },
        { tenantId: '3', schoolName: 'Delhi Public School', lastLogin: '1 day ago', lastDataWrite: '6 hours ago', activeUsers: 210, storageUsedGb: 8.5 },
        { tenantId: '4', schoolName: 'Cambridge International', lastLogin: '2 days ago', lastDataWrite: '1 day ago', activeUsers: 156, storageUsedGb: 6.2 },
        { tenantId: '5', schoolName: 'National Academy', lastLogin: '3 days ago', lastDataWrite: '2 days ago', activeUsers: 78, storageUsedGb: 2.1 },
      ])
    );
  }),
];

export default dashboardHandlers;
