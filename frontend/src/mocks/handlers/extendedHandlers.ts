import { http, HttpResponse, delay } from 'msw';
import {
  mockAttendance, mockExamMarks, mockFeeStructures, mockFeePayments,
  mockMentoringNotes, mockMcqQuestions, mockMcqExams, mockTimetable,
  mockAuditLogs, mockTenants,
} from '../data/mockData';

const API_BASE = '/api/v1';

const apiResponse = <T>(data: T, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const extendedHandlers = [
  // ==================== Attendance ====================
  http.post(`${API_BASE}/attendance/mark`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockAttendance, 'Attendance marked successfully'));
  }),

  http.get(`${API_BASE}/attendance/class/:classId`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockAttendance));
  }),

  http.get(`${API_BASE}/attendance/summary/student/:studentId`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse({
      studentId: 'student-001',
      totalDays: 90,
      present: 82,
      absent: 4,
      late: 3,
      halfDay: 1,
      attendancePercentage: 92.5,
    }));
  }),

  // ==================== Exams & Marks ====================
  http.get(`${API_BASE}/exams`, async () => {
    await delay(300);
    const { mockExams } = await import('../data/mockData');
    return HttpResponse.json(apiResponse(mockExams));
  }),

  http.post(`${API_BASE}/exams`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      examId: `exam-${Date.now()}`,
      ...body,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
    }, 'Exam created successfully'), { status: 201 });
  }),

  http.get(`${API_BASE}/exams/:examId/marks`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockExamMarks));
  }),

  http.post(`${API_BASE}/exams/marks`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(mockExamMarks, 'Marks entered successfully'));
  }),

  http.patch(`${API_BASE}/exams/:examId/lock-marks`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(null, 'Marks locked successfully'));
  }),

  // ==================== MCQ ====================
  http.get(`${API_BASE}/mcq/questions`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockMcqQuestions));
  }),

  http.post(`${API_BASE}/mcq/questions`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      questionId: `mcq-q-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    }, 'Question created'), { status: 201 });
  }),

  http.get(`${API_BASE}/mcq/exams`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockMcqExams));
  }),

  http.post(`${API_BASE}/mcq/exams`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      examId: `mcq-exam-${Date.now()}`,
      ...body,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    }), { status: 201 });
  }),

  http.patch(`${API_BASE}/mcq/exams/:examId/publish`, async ({ params }) => {
    await delay(300);
    const exam = mockMcqExams.find(e => e.examId === params.examId);
    return HttpResponse.json(apiResponse({ ...exam, status: 'PUBLISHED' }));
  }),

  http.post(`${API_BASE}/mcq/exams/:examId/start`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse({
      attemptId: `attempt-${Date.now()}`,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
    }));
  }),

  http.post(`${API_BASE}/mcq/exams/:examId/submit`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse({
      score: 80,
      totalQuestions: 5,
      correctAnswers: 4,
      submittedAt: new Date().toISOString(),
      status: 'SUBMITTED',
    }));
  }),

  // ==================== Fees ====================
  http.get(`${API_BASE}/fees/structures`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockFeeStructures));
  }),

  http.post(`${API_BASE}/fees/structures`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      feeStructureId: `fee-str-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    }), { status: 201 });
  }),

  http.get(`${API_BASE}/fees/payments/student/:studentId`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockFeePayments));
  }),

  http.post(`${API_BASE}/fees/payments`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      paymentId: `pay-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    }), { status: 201 });
  }),

  // ==================== Mentoring ====================
  http.get(`${API_BASE}/students/:studentId/mentoring-notes`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockMentoringNotes));
  }),

  http.post(`${API_BASE}/students/:studentId/mentoring-notes`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      noteId: `mnote-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    }), { status: 201 });
  }),

  // ==================== Timetable ====================
  http.get(`${API_BASE}/timetable`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockTimetable));
  }),

  http.get(`${API_BASE}/timetable/today`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockTimetable));
  }),

  http.get(`${API_BASE}/timetable/me`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockTimetable.slice(0, 3)));
  }),

  // ==================== Events (CRUD) ====================
  http.get(`${API_BASE}/events`, async () => {
    await delay(300);
    const { mockEvents } = await import('../data/mockData');
    return HttpResponse.json(apiResponse(mockEvents));
  }),

  http.post(`${API_BASE}/events`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(apiResponse({
      eventId: `event-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    }), { status: 201 });
  }),

  http.get(`${API_BASE}/events/holidays`, async () => {
    await delay(300);
    const { mockEvents } = await import('../data/mockData');
    return HttpResponse.json(apiResponse(mockEvents.filter(e => e.isHoliday)));
  }),

  // ==================== Settings ====================
  http.get(`${API_BASE}/settings`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse({
      settingsId: 'settings-001',
      tenantId: 'tenant-001',
      admissionNumberFormat: 'ADM-{YEAR}-{SEQ}',
      rollNumberFormat: 'NUMERIC',
      employeeIdFormat: 'EMP-{SEQ}',
      passwordPolicy: { minLength: 8, requireUppercase: true, requireSpecialChar: true, expiryDays: 90 },
      attendanceWindowHours: 24,
      lateThresholdMinutes: 15,
      defaultPassingMarksPercent: 35,
      feeGracePeriodDays: 15,
      maxLoginAttempts: 5,
      sessionTimeoutMinutes: 30,
    }));
  }),

  // ==================== Super Admin ====================
  http.get(`${API_BASE}/super/tenants`, async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const status = url.searchParams.get('status');

    let filtered = [...mockTenants];
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }

    const start = page * size;
    const content = filtered.slice(start, start + size);

    return HttpResponse.json(apiResponse({
      content,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      page,
      size,
    }));
  }),

  http.get(`${API_BASE}/super/tenants/:tenantId`, async ({ params }) => {
    await delay(300);
    const tenant = mockTenants.find(t => t.tenantId === params.tenantId);
    if (!tenant) {
      return HttpResponse.json({ success: false, message: 'Tenant not found', data: null, timestamp: new Date().toISOString() }, { status: 404 });
    }
    return HttpResponse.json(apiResponse(tenant));
  }),

  http.get(`${API_BASE}/super/tenants/stats`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse({
      totalTenants: mockTenants.length,
      activeTenants: mockTenants.filter(t => t.status === 'ACTIVE').length,
      inactiveTenants: mockTenants.filter(t => t.status === 'INACTIVE').length,
      suspendedTenants: mockTenants.filter(t => t.status === 'SUSPENDED').length,
    }));
  }),

  http.get(`${API_BASE}/super/audit-logs`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse({
      content: mockAuditLogs,
      totalElements: mockAuditLogs.length,
      totalPages: 1,
      page: 0,
      size: 20,
    }));
  }),

  // ==================== Dashboard ====================
  http.get(`${API_BASE}/dashboard`, async () => {
    await delay(500);
    const { mockDashboardStats } = await import('../data/mockData');
    return HttpResponse.json(apiResponse(mockDashboardStats.schoolAdmin));
  }),

  // ==================== WhatsApp ====================
  http.post(`${API_BASE}/whatsapp/resolve-recipients`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse([
      { parentId: 'p1', parentName: 'Rajesh Kumar', phone: '+919876543210' },
      { parentId: 'p2', parentName: 'Priya Sharma', phone: '+919876543211' },
      { parentId: 'p3', parentName: 'Amit Patel', phone: '+919876543212' },
      { parentId: 'p4', parentName: 'Sunita Verma', phone: '+919876543213' },
      { parentId: 'p5', parentName: 'Deepak Singh', phone: '+919876543214' },
    ]));
  }),

  http.post(`${API_BASE}/whatsapp/send`, async () => {
    await delay(800);
    return HttpResponse.json(apiResponse({
      messageId: 'wa-' + Date.now(),
      sentBy: 'user-1',
      sentByName: 'John Teacher',
      recipientType: 'CLASS',
      classId: 'class-1',
      className: '10th Grade - A',
      parentIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      recipients: [
        { parentId: 'p1', parentName: 'Rajesh Kumar', phone: '+919876543210', deliveryStatus: 'PENDING' },
        { parentId: 'p2', parentName: 'Priya Sharma', phone: '+919876543211', deliveryStatus: 'PENDING' },
        { parentId: 'p3', parentName: 'Amit Patel', phone: '+919876543212', deliveryStatus: 'PENDING' },
      ],
      messageBody: 'Test message',
      contentType: 'TEXT',
      totalRecipients: 3,
      successCount: 0,
      failureCount: 0,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    }, 'WhatsApp messages queued for delivery'));
  }),

  http.get(`${API_BASE}/whatsapp/messages`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse({
      content: [
        {
          messageId: 'wa-1',
          sentBy: 'user-1',
          sentByName: 'John Teacher',
          recipientType: 'CLASS',
          className: '10th Grade - A',
          messageBody: 'Dear parents, please note that the parent-teacher meeting is scheduled for this Saturday.',
          contentType: 'TEXT',
          totalRecipients: 25,
          successCount: 23,
          failureCount: 2,
          status: 'PARTIALLY_FAILED',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          completedAt: new Date(Date.now() - 86300000).toISOString(),
          recipients: [],
          parentIds: [],
        },
        {
          messageId: 'wa-2',
          sentBy: 'user-1',
          sentByName: 'John Teacher',
          recipientType: 'CLASS',
          className: '9th Grade - B',
          messageBody: 'Reminder: Annual day practice tomorrow at 3 PM.',
          contentType: 'TEXT',
          totalRecipients: 30,
          successCount: 30,
          failureCount: 0,
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          completedAt: new Date(Date.now() - 172700000).toISOString(),
          recipients: [],
          parentIds: [],
        },
        {
          messageId: 'wa-3',
          sentBy: 'user-2',
          sentByName: 'Admin User',
          recipientType: 'INDIVIDUAL',
          messageBody: 'Fee payment reminder for the current semester.',
          contentType: 'DOCUMENT',
          mediaFileName: 'fee_notice.pdf',
          totalRecipients: 5,
          successCount: 5,
          failureCount: 0,
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          completedAt: new Date(Date.now() - 259100000).toISOString(),
          recipients: [],
          parentIds: [],
        },
      ],
      totalElements: 3,
      totalPages: 1,
      page: 0,
      size: 10,
    }));
  }),

  http.get(`${API_BASE}/whatsapp/messages/:messageId`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse({
      messageId: 'wa-1',
      sentBy: 'user-1',
      sentByName: 'John Teacher',
      recipientType: 'CLASS',
      classId: 'class-1',
      className: '10th Grade - A',
      parentIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      recipients: [
        { parentId: 'p1', parentName: 'Rajesh Kumar', phone: '+919876543210', whatsappMessageId: 'wamid_1', deliveryStatus: 'SENT' },
        { parentId: 'p2', parentName: 'Priya Sharma', phone: '+919876543211', whatsappMessageId: 'wamid_2', deliveryStatus: 'SENT' },
        { parentId: 'p3', parentName: 'Amit Patel', phone: '+919876543212', whatsappMessageId: 'wamid_3', deliveryStatus: 'DELIVERED' },
        { parentId: 'p4', parentName: 'Sunita Verma', phone: '+919876543213', deliveryStatus: 'FAILED', errorMessage: 'Phone number not on WhatsApp' },
        { parentId: 'p5', parentName: 'Deepak Singh', phone: '+919876543214', whatsappMessageId: 'wamid_5', deliveryStatus: 'SENT' },
      ],
      messageBody: 'Dear parents, please note that the parent-teacher meeting is scheduled for this Saturday at 10 AM. Kindly confirm your attendance.',
      contentType: 'TEXT',
      totalRecipients: 5,
      successCount: 4,
      failureCount: 1,
      status: 'PARTIALLY_FAILED',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: new Date(Date.now() - 86300000).toISOString(),
    }));
  }),

  http.post(`${API_BASE}/whatsapp/upload-media`, async () => {
    await delay(600);
    return HttpResponse.json(apiResponse({
      url: '/uploads/whatsapp/sample_doc.pdf',
      fileName: 'sample_doc.pdf',
      mimeType: 'application/pdf',
    }));
  }),
];

export default extendedHandlers;
