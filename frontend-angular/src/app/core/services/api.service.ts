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

  getUsers(
    page = 0,
    size = 20
  ): Observable<ApiResponse<PaginatedResponse<User>>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<User>>>(
      `${this.API}/users`,
      { params }
    );
  }

  createUser(user: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.API}/users`, user);
  }

  // ── Students ───────────────────────────────────────────────────────────

  getStudents(
    page = 0,
    size = 20,
    classId?: string
  ): Observable<ApiResponse<PaginatedResponse<Student>>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (classId) params = params.set('classId', classId);
    return this.http.get<ApiResponse<PaginatedResponse<Student>>>(
      `${this.API}/students`,
      { params }
    );
  }

  createStudent(student: Partial<Student>): Observable<ApiResponse<Student>> {
    return this.http.post<ApiResponse<Student>>(
      `${this.API}/students`,
      student
    );
  }

  // ── Teachers ───────────────────────────────────────────────────────────

  getTeachers(
    page = 0,
    size = 20
  ): Observable<ApiResponse<PaginatedResponse<Teacher>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<Teacher>>>(
      `${this.API}/teachers`,
      { params }
    );
  }

  // ── Classes ────────────────────────────────────────────────────────────

  getClasses(): Observable<ApiResponse<SchoolClass[]>> {
    return this.http.get<ApiResponse<SchoolClass[]>>(`${this.API}/classes`);
  }

  createClass(
    schoolClass: Partial<SchoolClass>
  ): Observable<ApiResponse<SchoolClass>> {
    return this.http.post<ApiResponse<SchoolClass>>(
      `${this.API}/classes`,
      schoolClass
    );
  }

  // ── Academic Years ─────────────────────────────────────────────────────

  getAcademicYears(): Observable<ApiResponse<AcademicYear[]>> {
    return this.http.get<ApiResponse<AcademicYear[]>>(
      `${this.API}/academic-years`
    );
  }

  createAcademicYear(
    year: Partial<AcademicYear>
  ): Observable<ApiResponse<AcademicYear>> {
    return this.http.post<ApiResponse<AcademicYear>>(
      `${this.API}/academic-years`,
      year
    );
  }

  // ── Attendance ─────────────────────────────────────────────────────────

  markAttendance(payload: {
    classId: string;
    date: string;
    records: { studentId: string; status: string }[];
  }): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.API}/attendance`,
      payload
    );
  }

  getAttendanceSummary(
    classId: string,
    month: string
  ): Observable<ApiResponse<any>> {
    const params = new HttpParams()
      .set('classId', classId)
      .set('month', month);
    return this.http.get<ApiResponse<any>>(`${this.API}/attendance/summary`, {
      params,
    });
  }

  // ── Exams ──────────────────────────────────────────────────────────────

  getExams(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/exams`);
  }

  createExam(exam: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API}/exams`, exam);
  }

  enterMarks(
    examId: string,
    marks: { studentId: string; subjectId: string; marksObtained: number }[]
  ): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.API}/exams/${examId}/marks`,
      marks
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────

  getDashboard(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/dashboard`);
  }

  // ── Notifications ──────────────────────────────────────────────────────

  sendNotification(notification: Partial<Notification>): Observable<ApiResponse<Notification>> {
    return this.http.post<ApiResponse<Notification>>(
      `${this.API}/notifications`,
      notification
    );
  }

  getNotifications(
    page = 0,
    size = 20
  ): Observable<ApiResponse<PaginatedResponse<Notification>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<Notification>>>(
      `${this.API}/notifications`,
      { params }
    );
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────

  sendWhatsAppMessage(
    req: SendWhatsAppRequest
  ): Observable<ApiResponse<WhatsAppMessage>> {
    return this.http.post<ApiResponse<WhatsAppMessage>>(
      `${this.API}/whatsapp/messages`,
      req
    );
  }

  getWhatsAppMessages(
    page = 0,
    size = 20
  ): Observable<ApiResponse<PaginatedResponse<WhatsAppMessage>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<WhatsAppMessage>>>(
      `${this.API}/whatsapp/messages`,
      { params }
    );
  }

  getWhatsAppMessageById(
    messageId: string
  ): Observable<ApiResponse<WhatsAppMessage>> {
    return this.http.get<ApiResponse<WhatsAppMessage>>(
      `${this.API}/whatsapp/messages/${messageId}`
    );
  }

  resolveWhatsAppRecipients(
    recipientType: 'CLASS' | 'INDIVIDUAL',
    classId?: string,
    parentIds?: string[]
  ): Observable<ApiResponse<WhatsAppRecipientInfo[]>> {
    const body: any = { recipientType };
    if (classId) body.classId = classId;
    if (parentIds) body.parentIds = parentIds;
    return this.http.post<ApiResponse<WhatsAppRecipientInfo[]>>(
      `${this.API}/whatsapp/recipients/resolve`,
      body
    );
  }

  uploadWhatsAppMedia(file: File): Observable<ApiResponse<{ url: string; fileName: string; mimeType: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<{ url: string; fileName: string; mimeType: string }>>(
      `${this.API}/whatsapp/media/upload`,
      formData
    );
  }

  // ── Super Admin: Tenants ───────────────────────────────────────────────

  getTenants(
    page = 0,
    size = 20
  ): Observable<ApiResponse<PaginatedResponse<Tenant>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PaginatedResponse<Tenant>>>(
      `${this.API}/super/tenants`,
      { params }
    );
  }

  createTenant(
    req: CreateTenantRequest
  ): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(
      `${this.API}/super/tenants`,
      req
    );
  }

  updateTenantFeatures(
    tenantId: string,
    featureFlags: Record<string, boolean>
  ): Observable<ApiResponse<Tenant>> {
    return this.http.patch<ApiResponse<Tenant>>(
      `${this.API}/super/tenants/${tenantId}/features`,
      featureFlags
    );
  }

  getGlobalStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API}/super/stats`);
  }
}
