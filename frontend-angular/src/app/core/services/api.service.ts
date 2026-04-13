import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResponse,
  User,
  Student,
  Teacher,
  SchoolClass,
  AcademicYear,
  Notification,
  WhatsAppMessage,
  WhatsAppRecipientInfo,
  SendWhatsAppRequest,
  Tenant,
  CreateTenantRequest,
  FeatureToggleRequest,
  BulkFeatureToggleRequest,
  SchoolFeatureResponse,
  FeatureAuditLog,
  FeatureTemplate,
  IdCardRequest,
  IdCardResponse,
  ReportCard,
  GenerateReportCardRequest,
  Syllabus,
  CreateSyllabusRequest,
  UpdateTopicStatusRequest,
  Assignment,
  AssignmentSubmission,
  CreateAssignmentRequest,
  GradeSubmissionRequest,
  StudentPerformance,
  ClassRanking,
  GradeDistribution,
  PtmMeeting,
  PtmSlot,
  CreatePtmRequest,
  BookPtmSlotRequest,
  Timetable,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly API = '/api/v1';

  constructor(private http: HttpClient) {}

  // ── Users ──────────────────────────────────────────────────────────────

  getUsers(page = 0, size = 20, params?: { role?: string; status?: string; search?: string }): Observable<ApiResponse<PaginatedResponse<User>>> {
    let httpParams = new HttpParams().set('page', page).set('size', size);
    if (params?.role) httpParams = httpParams.set('role', params.role);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<ApiResponse<PaginatedResponse<User>>>(`${this.API}/users`, { params: httpParams });
  }

  getUserById(userId: string): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.API}/users/${userId}`);
  }

  createUser(user: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.API}/users`, user);
  }

  updateUser(userId: string, user: Partial<User>): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.API}/users/${userId}`, user);
  }

  deleteUser(userId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/users/${userId}`);
  }

  updateUserStatus(userId: string, active: boolean): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/users/${userId}/status`, null, {
      params: new HttpParams().set('active', active),
    });
  }

  unlockUser(userId: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/users/${userId}/unlock`, null);
  }

  // ── Students ───────────────────────────────────────────────────────────

  getStudents(page = 0, size = 20, params?: { classId?: string; sectionId?: string; search?: string; gender?: string }): Observable<ApiResponse<PaginatedResponse<Student>>> {
    let httpParams = new HttpParams().set('page', page).set('size', size);
    if (params?.classId) httpParams = httpParams.set('classId', params.classId);
    if (params?.sectionId) httpParams = httpParams.set('sectionId', params.sectionId);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.gender) httpParams = httpParams.set('gender', params.gender);
    return this.http.get<ApiResponse<PaginatedResponse<Student>>>(`${this.API}/students`, { params: httpParams });
  }

  getStudentById(studentId: string): Observable<ApiResponse<Student>> {
    return this.http.get<ApiResponse<Student>>(`${this.API}/students/${studentId}`);
  }

  createStudent(student: Partial<Student>): Observable<ApiResponse<Student>> {
    return this.http.post<ApiResponse<Student>>(`${this.API}/students`, student);
  }

  updateStudent(studentId: string, student: Partial<Student>): Observable<ApiResponse<Student>> {
    return this.http.put<ApiResponse<Student>>(`${this.API}/students/${studentId}`, student);
  }

  deleteStudent(studentId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/students/${studentId}`);
  }

  // ── Teachers ───────────────────────────────────────────────────────────

  getTeachers(page = 0, size = 20): Observable<ApiResponse<PaginatedResponse<Teacher>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<Teacher>>>(`${this.API}/teachers`, { params });
  }

  getTeacherById(teacherId: string): Observable<ApiResponse<Teacher>> {
    return this.http.get<ApiResponse<Teacher>>(`${this.API}/teachers/${teacherId}`);
  }

  createTeacher(teacher: Partial<Teacher>): Observable<ApiResponse<Teacher>> {
    return this.http.post<ApiResponse<Teacher>>(`${this.API}/teachers`, teacher);
  }

  updateTeacher(teacherId: string, teacher: Partial<Teacher>): Observable<ApiResponse<Teacher>> {
    return this.http.put<ApiResponse<Teacher>>(`${this.API}/teachers/${teacherId}`, teacher);
  }

  deleteTeacher(teacherId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/teachers/${teacherId}`);
  }

  // ── Classes ────────────────────────────────────────────────────────────

  getClasses(): Observable<ApiResponse<SchoolClass[]>> {
    return this.http.get<ApiResponse<SchoolClass[]>>(`${this.API}/classes`);
  }

  getClassById(classId: string): Observable<ApiResponse<SchoolClass>> {
    return this.http.get<ApiResponse<SchoolClass>>(`${this.API}/classes/${classId}`);
  }

  createClass(schoolClass: Partial<SchoolClass>): Observable<ApiResponse<SchoolClass>> {
    return this.http.post<ApiResponse<SchoolClass>>(`${this.API}/classes`, schoolClass);
  }

  updateClass(classId: string, schoolClass: Partial<SchoolClass>): Observable<ApiResponse<SchoolClass>> {
    return this.http.put<ApiResponse<SchoolClass>>(`${this.API}/classes/${classId}`, schoolClass);
  }

  deleteClass(classId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/classes/${classId}`);
  }

  // ── Academic Years ─────────────────────────────────────────────────────

  getAcademicYears(): Observable<ApiResponse<AcademicYear[]>> {
    return this.http.get<ApiResponse<AcademicYear[]>>(`${this.API}/academic-years`);
  }

  createAcademicYear(year: Partial<AcademicYear>): Observable<ApiResponse<AcademicYear>> {
    return this.http.post<ApiResponse<AcademicYear>>(`${this.API}/academic-years`, year);
  }

  setCurrentAcademicYear(id: string): Observable<ApiResponse<AcademicYear>> {
    return this.http.patch<ApiResponse<AcademicYear>>(`${this.API}/academic-years/${id}/set-current`, null);
  }

  archiveAcademicYear(id: string): Observable<ApiResponse<AcademicYear>> {
    return this.http.patch<ApiResponse<AcademicYear>>(`${this.API}/academic-years/${id}/archive`, null);
  }

  deleteAcademicYear(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/academic-years/${id}`);
  }

  // ── Attendance ─────────────────────────────────────────────────────────

  markAttendance(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/attendance/mark`, payload);
  }

  getClassAttendance(classId: string, sectionId: string, date: string): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('sectionId', sectionId).set('date', date);
    return this.http.get<ApiResponse<any>>(`${this.API}/attendance/class/${classId}`, { params });
  }

  getStudentAttendanceSummary(studentId: string, from: string, to: string): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ApiResponse<any>>(`${this.API}/attendance/summary/student/${studentId}`, { params });
  }

  getClassAttendanceReport(classId: string, sectionId: string, from: string, to: string): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('sectionId', sectionId).set('from', from).set('to', to);
    return this.http.get<ApiResponse<any>>(`${this.API}/attendance/report/class/${classId}`, { params });
  }

  // ── Report Cards ───────────────────────────────────────────────────────

  getReportCards(classId: string, academicYearId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/report-cards/class/${classId}/generate?academicYearId=${academicYearId}`);
  }

  generateReportCards(params: { classId: string; academicYearId: string; studentIds: string[] }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/report-cards/class/${params.classId}/generate?academicYearId=${params.academicYearId}`, null);
  }

  getStudentReportCard(studentId: string, academicYearId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/report-cards/student/${studentId}?academicYearId=${academicYearId}`);
  }

  downloadReportCardPdf(studentId: string, academicYearId: string, tenantId: string): Observable<Blob> {
    return this.http.get(`${this.API}/report-cards/student/${studentId}/pdf?academicYearId=${academicYearId}&tenantId=${tenantId}`, {
      responseType: 'blob',
    });
  }

  // ── Exams ──────────────────────────────────────────────────────────────

  getExams(params?: { classId?: string; academicYearId?: string }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params?.classId) httpParams = httpParams.set('classId', params.classId);
    if (params?.academicYearId) httpParams = httpParams.set('academicYearId', params.academicYearId);
    return this.http.get<ApiResponse<any[]>>(`${this.API}/exams`, { params: httpParams });
  }

  getExamById(examId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/exams/${examId}`);
  }

  createExam(exam: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/exams`, exam);
  }

  updateExam(examId: string, exam: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.API}/exams/${examId}`, exam);
  }

  getExamMarks(examId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/exams/${examId}/marks`);
  }

  enterMarks(payload: { examId: string; marks: any[] }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/exams/marks`, payload);
  }

  lockMarks(examId: string): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.API}/exams/${examId}/lock-marks`, null);
  }

  // Student marks
  getMyMarks(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/exams/my-marks`);
  }

  getStudentExamMarks(studentId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/exams/student/${studentId}/marks`);
  }

  getExamCalendar(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/exams/calendar`);
  }

  getExamResults(examId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/exams/${examId}/results`);
  }

  deleteExam(examId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/exams/${examId}`);
  }

  // ── MCQ ────────────────────────────────────────────────────────────────

  getMcqExams(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/mcq/exams`);
  }

  createMcqExam(exam: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/mcq/exams`, exam);
  }

  publishMcqExam(examId: string): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.API}/mcq/exams/${examId}/publish`, null);
  }

  getAvailableMcqExams(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/mcq/exams/available`);
  }

  startMcqExam(examId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/mcq/exams/${examId}/start`, null);
  }

  submitMcqExam(examId: string, answers: number[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/mcq/exams/${examId}/submit`, { answers });
  }

  getMcqQuestions(params?: { subjectId?: string; difficulty?: string }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params?.subjectId) httpParams = httpParams.set('subjectId', params.subjectId);
    if (params?.difficulty) httpParams = httpParams.set('difficulty', params.difficulty);
    return this.http.get<ApiResponse<any[]>>(`${this.API}/mcq/questions`, { params: httpParams });
  }

  createMcqQuestion(question: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/mcq/questions`, question);
  }

  updateMcqQuestion(questionId: string, question: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.API}/mcq/questions/${questionId}`, question);
  }

  deleteMcqQuestion(questionId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/mcq/questions/${questionId}`);
  }

  // ── Dashboard ──────────────────────────────────────────────────────────

  getDashboard(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/dashboard`);
  }

  // ── Notifications ──────────────────────────────────────────────────────

  getNotifications(page = 0, size = 20): Observable<ApiResponse<PaginatedResponse<Notification>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<Notification>>>(`${this.API}/notifications`, { params });
  }

  sendNotification(notification: Partial<Notification>): Observable<ApiResponse<Notification>> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/notifications`, notification);
  }

  markNotificationRead(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/notifications/${id}/read`, null);
  }

  getUnreadNotificationCount(): Observable<ApiResponse<number>> {
    return this.http.get<ApiResponse<number>>(`${this.API}/notifications/unread-count`);
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────

  sendWhatsAppMessage(req: SendWhatsAppRequest): Observable<ApiResponse<WhatsAppMessage>> {
    return this.http.post<ApiResponse<WhatsAppMessage>>(`${this.API}/whatsapp/send`, req);
  }

  getWhatsAppMessages(page = 0, size = 20): Observable<ApiResponse<PaginatedResponse<WhatsAppMessage>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<WhatsAppMessage>>>(`${this.API}/whatsapp/messages`, { params });
  }

  getWhatsAppMessageById(messageId: string): Observable<ApiResponse<WhatsAppMessage>> {
    return this.http.get<ApiResponse<WhatsAppMessage>>(`${this.API}/whatsapp/messages/${messageId}`);
  }

  resolveWhatsAppRecipients(recipientType: 'CLASS' | 'INDIVIDUAL', classId?: string, parentIds?: string[]): Observable<ApiResponse<WhatsAppRecipientInfo[]>> {
    const body: any = { recipientType };
    if (classId) body.classId = classId;
    if (parentIds) body.parentIds = parentIds;
    return this.http.post<ApiResponse<WhatsAppRecipientInfo[]>>(`${this.API}/whatsapp/resolve-recipients`, body);
  }

  uploadWhatsAppMedia(file: File): Observable<ApiResponse<{ url: string; fileName: string; mimeType: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<{ url: string; fileName: string; mimeType: string }>>(`${this.API}/whatsapp/upload-media`, formData);
  }

  // ── Super Admin: Tenants ───────────────────────────────────────────────

  getTenants(page = 0, size = 20, params?: { status?: string; search?: string }): Observable<ApiResponse<PaginatedResponse<Tenant>>> {
    let httpParams = new HttpParams().set('page', page).set('size', size);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<ApiResponse<PaginatedResponse<Tenant>>>(`${this.API}/super/tenants`, { params: httpParams });
  }

  getTenantById(tenantId: string): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.API}/super/tenants/${tenantId}`);
  }

  createTenant(req: CreateTenantRequest): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.API}/super/tenants`, req);
  }

  updateTenant(tenantId: string, req: any): Observable<ApiResponse<Tenant>> {
    return this.http.put<ApiResponse<Tenant>>(`${this.API}/super/tenants/${tenantId}`, req);
  }

  changeTenantStatus(tenantId: string, status: string, reason?: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/super/tenants/${tenantId}/status`, { status, reason });
  }

  deleteTenant(tenantId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/super/tenants/${tenantId}`);
  }

  getTenantFeatures(tenantId: string): Observable<ApiResponse<Record<string, boolean>>> {
    return this.http.get<ApiResponse<Record<string, boolean>>>(`${this.API}/super/tenants/${tenantId}/features`);
  }

  updateTenantFeatures(tenantId: string, featureFlags: Record<string, boolean>): Observable<ApiResponse<Record<string, boolean>>> {
    return this.http.put<ApiResponse<Record<string, boolean>>>(`${this.API}/super/tenants/${tenantId}/features`, featureFlags);
  }

  enableTenantFeature(tenantId: string, featureKey: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/super/tenants/${tenantId}/features/${featureKey}/enable`, null);
  }

  disableTenantFeature(tenantId: string, featureKey: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/super/tenants/${tenantId}/features/${featureKey}/disable`, null);
  }

  getGlobalStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/super/tenants/stats`);
  }

  // ── Settings ───────────────────────────────────────────────────────────

  getSettings(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/settings`);
  }

  updateSettings(settings: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.API}/settings`, settings);
  }

  // ── Events ─────────────────────────────────────────────────────────────

  getEvents(params?: { from?: string; to?: string }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    return this.http.get<ApiResponse<any[]>>(`${this.API}/events`, { params: httpParams });
  }

  createEvent(event: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/events`, event);
  }

  // ── Fees ───────────────────────────────────────────────────────────────

  getFeeStructures(academicYearId: string, classId?: string): Observable<ApiResponse<any[]>> {
    let params = new HttpParams().set('academicYearId', academicYearId);
    if (classId) params = params.set('classId', classId);
    return this.http.get<ApiResponse<any[]>>(`${this.API}/fees/structures`, { params });
  }

  getStudentFeePayments(studentId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/fees/payments/student/${studentId}`);
  }

  // ── Feature Management ───────────────────────────────────────────────
  getFeatureCatalog(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/super/features/catalog`);
  }

  getSchoolFeatures(tenantId: string): Observable<ApiResponse<SchoolFeatureResponse>> {
    return this.http.get<ApiResponse<SchoolFeatureResponse>>(`${this.API}/super/features/schools/${tenantId}`);
  }

  toggleFeature(tenantId: string, req: FeatureToggleRequest): Observable<ApiResponse<Record<string, boolean>>> {
    return this.http.put<ApiResponse<Record<string, boolean>>>(`${this.API}/super/features/schools/${tenantId}/toggle`, req);
  }

  bulkToggleFeatures(tenantId: string, req: BulkFeatureToggleRequest): Observable<ApiResponse<Record<string, boolean>>> {
    return this.http.put<ApiResponse<Record<string, boolean>>>(`${this.API}/super/features/schools/${tenantId}/bulk`, req);
  }

  getFeatureAuditLog(tenantId: string, page = 0, size = 20): Observable<ApiResponse<PaginatedResponse<FeatureAuditLog>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<FeatureAuditLog>>>(`${this.API}/super/features/schools/${tenantId}/audit`, { params });
  }

  undoFeatureToggle(tenantId: string, auditId: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API}/super/features/schools/${tenantId}/audit/${auditId}/undo`, null);
  }

  applyFeatureTemplate(tenantId: string, templateId: string): Observable<ApiResponse<Record<string, boolean>>> {
    return this.http.post<ApiResponse<Record<string, boolean>>>(`${this.API}/super/features/schools/${tenantId}/apply-template`, { templateId });
  }

  getFeatureTemplates(): Observable<ApiResponse<FeatureTemplate[]>> {
    return this.http.get<ApiResponse<FeatureTemplate[]>>(`${this.API}/super/features/templates`);
  }

  createFeatureTemplate(req: { name: string; description: string; featureFlags: Record<string, boolean> }): Observable<ApiResponse<FeatureTemplate>> {
    return this.http.post<ApiResponse<FeatureTemplate>>(`${this.API}/super/features/templates`, req);
  }

  deleteFeatureTemplate(templateId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/super/features/templates/${templateId}`);
  }

  // ── ID Card ───────────────────────────────────────────────────────────
  generateStudentIdCard(studentId: string, tenantId: string): Observable<Blob> {
    return this.http.get(`${this.API}/idcards/student/${studentId}?tenantId=${tenantId}`, { responseType: 'blob' });
  }

  generateTeacherIdCard(teacherId: string, tenantId: string): Observable<Blob> {
    return this.http.get(`${this.API}/idcards/teacher/${teacherId}?tenantId=${tenantId}`, { responseType: 'blob' });
  }

  generateBulkIdCards(cardType: string, userIds: string[], tenantId: string): Observable<Blob> {
    return this.http.post(`${this.API}/idcards/bulk?tenantId=${tenantId}`, { cardType, userIds }, { responseType: 'blob' });
  }

  // ── Syllabus ──────────────────────────────────────────────────────────
  getSyllabusList(params?: { classId?: string; academicYearId?: string }): Observable<ApiResponse<Syllabus[]>> {
    let httpParams = new HttpParams();
    if (params?.classId) httpParams = httpParams.set('classId', params.classId);
    if (params?.academicYearId) httpParams = httpParams.set('academicYearId', params.academicYearId);
    return this.http.get<ApiResponse<Syllabus[]>>(`${this.API}/syllabus`, { params: httpParams });
  }

  getSyllabusById(syllabusId: string): Observable<ApiResponse<Syllabus>> {
    return this.http.get<ApiResponse<Syllabus>>(`${this.API}/syllabus/${syllabusId}`);
  }

  createSyllabus(req: CreateSyllabusRequest): Observable<ApiResponse<Syllabus>> {
    return this.http.post<ApiResponse<Syllabus>>(`${this.API}/syllabus`, req);
  }

  updateSyllabus(syllabusId: string, req: CreateSyllabusRequest): Observable<ApiResponse<Syllabus>> {
    return this.http.put<ApiResponse<Syllabus>>(`${this.API}/syllabus/${syllabusId}`, req);
  }

  updateTopicStatus(syllabusId: string, req: UpdateTopicStatusRequest): Observable<ApiResponse<Syllabus>> {
    return this.http.patch<ApiResponse<Syllabus>>(`${this.API}/syllabus/${syllabusId}/topics`, req);
  }

  deleteSyllabus(syllabusId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/syllabus/${syllabusId}`);
  }

  // ── Assignments ───────────────────────────────────────────────────────
  getAssignments(page = 0, size = 20, params?: { classId?: string; subjectId?: string; status?: string }): Observable<ApiResponse<PaginatedResponse<Assignment>>> {
    let httpParams = new HttpParams().set('page', page).set('size', size);
    if (params?.classId) httpParams = httpParams.set('classId', params.classId);
    if (params?.subjectId) httpParams = httpParams.set('subjectId', params.subjectId);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<ApiResponse<PaginatedResponse<Assignment>>>(`${this.API}/assignments`, { params: httpParams });
  }

  getAssignmentById(assignmentId: string): Observable<ApiResponse<Assignment>> {
    return this.http.get<ApiResponse<Assignment>>(`${this.API}/assignments/${assignmentId}`);
  }

  createAssignment(req: CreateAssignmentRequest): Observable<ApiResponse<Assignment>> {
    return this.http.post<ApiResponse<Assignment>>(`${this.API}/assignments`, req);
  }

  updateAssignment(assignmentId: string, req: CreateAssignmentRequest): Observable<ApiResponse<Assignment>> {
    return this.http.put<ApiResponse<Assignment>>(`${this.API}/assignments/${assignmentId}`, req);
  }

  deleteAssignment(assignmentId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/assignments/${assignmentId}`);
  }

  uploadAssignmentFile(assignmentId: string, file: File): Observable<ApiResponse<{ url: string; fileName: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<{ url: string; fileName: string }>>(`${this.API}/assignments/${assignmentId}/upload`, formData);
  }

  getAssignmentSubmissions(assignmentId: string): Observable<ApiResponse<AssignmentSubmission[]>> {
    return this.http.get<ApiResponse<AssignmentSubmission[]>>(`${this.API}/assignments/${assignmentId}/submissions`);
  }

  submitAssignment(assignmentId: string, formData: FormData): Observable<ApiResponse<AssignmentSubmission>> {
    return this.http.post<ApiResponse<AssignmentSubmission>>(`${this.API}/assignments/${assignmentId}/submit`, formData);
  }

  gradeSubmission(assignmentId: string, submissionId: string, req: GradeSubmissionRequest): Observable<ApiResponse<AssignmentSubmission>> {
    return this.http.patch<ApiResponse<AssignmentSubmission>>(`${this.API}/assignments/${assignmentId}/submissions/${submissionId}/grade`, req);
  }

  // ── Performance Analytics ─────────────────────────────────────────────
  getStudentPerformance(studentId: string, academicYearId?: string): Observable<ApiResponse<StudentPerformance>> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    return this.http.get<ApiResponse<StudentPerformance>>(`${this.API}/analytics/students/${studentId}`, { params });
  }

  getClassRankings(classId: string, examId?: string): Observable<ApiResponse<ClassRanking[]>> {
    let params = new HttpParams();
    if (examId) params = params.set('examId', examId);
    return this.http.get<ApiResponse<ClassRanking[]>>(`${this.API}/analytics/classes/${classId}/rankings`, { params });
  }

  getClassPerformance(classId: string, academicYearId?: string): Observable<ApiResponse<any>> {
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    return this.http.get<ApiResponse<any>>(`${this.API}/analytics/classes/${classId}`, { params });
  }

  // ── PTM ───────────────────────────────────────────────────────────────
  getPtmMeetings(params?: { status?: string }): Observable<ApiResponse<PtmMeeting[]>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<ApiResponse<PtmMeeting[]>>(`${this.API}/ptm`, { params: httpParams });
  }

  getPtmById(ptmId: string): Observable<ApiResponse<PtmMeeting>> {
    return this.http.get<ApiResponse<PtmMeeting>>(`${this.API}/ptm/${ptmId}`);
  }

  createPtm(req: CreatePtmRequest): Observable<ApiResponse<PtmMeeting>> {
    return this.http.post<ApiResponse<PtmMeeting>>(`${this.API}/ptm`, req);
  }

  updatePtm(ptmId: string, req: Partial<CreatePtmRequest>): Observable<ApiResponse<PtmMeeting>> {
    return this.http.put<ApiResponse<PtmMeeting>>(`${this.API}/ptm/${ptmId}`, req);
  }

  deletePtm(ptmId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/ptm/${ptmId}`);
  }

  getPtmSlots(ptmId: string, teacherId?: string): Observable<ApiResponse<PtmSlot[]>> {
    let params = new HttpParams();
    if (teacherId) params = params.set('teacherId', teacherId);
    return this.http.get<ApiResponse<PtmSlot[]>>(`${this.API}/ptm/${ptmId}/slots`, { params });
  }

  bookPtmSlot(ptmId: string, req: BookPtmSlotRequest): Observable<ApiResponse<PtmSlot>> {
    return this.http.post<ApiResponse<PtmSlot>>(`${this.API}/ptm/${ptmId}/book`, req);
  }

  cancelPtmSlot(ptmId: string, slotId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/ptm/${ptmId}/slots/${slotId}`);
  }

  completePtmSlot(ptmId: string, slotId: string): Observable<ApiResponse<PtmSlot>> {
    return this.http.patch<ApiResponse<PtmSlot>>(`${this.API}/ptm/${ptmId}/slots/${slotId}/complete`, null);
  }

  getTeacherPtmSchedule(ptmId: string, teacherId: string): Observable<ApiResponse<PtmSlot[]>> {
    return this.http.get<ApiResponse<PtmSlot[]>>(`${this.API}/ptm/${ptmId}/teachers/${teacherId}/schedule`);
  }

  // ── Timetable ─────────────────────────────────────────────────────────

  getTimetable(classId: string, sectionId: string, academicYearId: string): Observable<ApiResponse<Timetable>> {
    const params = new HttpParams().set('classId', classId).set('sectionId', sectionId).set('academicYearId', academicYearId);
    return this.http.get<ApiResponse<Timetable>>(`${this.API}/timetable`, { params });
  }

  getTimetableList(academicYearId: string): Observable<ApiResponse<Timetable[]>> {
    return this.http.get<ApiResponse<Timetable[]>>(`${this.API}/timetable/list`, { params: new HttpParams().set('academicYearId', academicYearId) });
  }

  saveTimetable(timetable: Partial<Timetable>): Observable<ApiResponse<Timetable>> {
    if (timetable.timetableId) {
      return this.http.put<ApiResponse<Timetable>>(`${this.API}/timetable/${timetable.timetableId}`, timetable);
    }
    return this.http.post<ApiResponse<Timetable>>(`${this.API}/timetable`, timetable);
  }

  deleteTimetable(timetableId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/timetable/${timetableId}`);
  }

  getTeacherTimetable(teacherId: string, academicYearId: string): Observable<ApiResponse<Timetable[]>> {
    return this.http.get<ApiResponse<Timetable[]>>(`${this.API}/timetable/teacher/${teacherId}`, { params: new HttpParams().set('academicYearId', academicYearId) });
  }

  // ── Audit Logs ────────────────────────────────────────────────────────
  getAuditLogs(page = 0, size = 20, filters?: { action?: string; entityType?: string; tenantId?: string; from?: string; to?: string; search?: string }): Observable<ApiResponse<any>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters?.action) params = params.set('action', filters.action);
    if (filters?.entityType) params = params.set('entityType', filters.entityType);
    if (filters?.tenantId) params = params.set('tenantId', filters.tenantId);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.search) params = params.set('search', filters.search);
    return this.http.get<ApiResponse<any>>(`${this.API}/super/audit-logs`, { params });
  }

  getAuditLogActions(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.API}/super/audit-logs/actions`);
  }

  getAuditLogEntityTypes(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.API}/super/audit-logs/entity-types`);
  }
}
