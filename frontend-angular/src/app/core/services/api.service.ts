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
}
