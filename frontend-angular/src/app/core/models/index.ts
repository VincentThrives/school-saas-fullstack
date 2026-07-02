// Enums
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  PRINCIPAL = 'PRINCIPAL',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
  /** Delegated school coordinator. Same default UI surface as
   *  SCHOOL_ADMIN but the sidenav + endpoint access is gated
   *  per-tenant by the Coordinator Access page the school admin
   *  manages. */
  SCHOOL_COORDINATOR = 'SCHOOL_COORDINATOR',
}

/** Catalog of sidenav modules that can be toggled on / off for the
 *  SCHOOL_COORDINATOR role at the tenant level. Keys must match the
 *  CoordinatorModule enum on the backend. */
export type CoordinatorModuleKey =
  | 'ATTENDANCE'
  | 'EXAMS'
  | 'SMS'
  | 'NOTIFICATIONS'
  | 'FEES'
  | 'REPORT_CARDS'
  | 'EVENTS'
  | 'TIMETABLE'
  | 'SUBJECTS'
  | 'CLASSES'
  | 'ACADEMIC_YEARS'
  | 'STUDENTS'
  | 'TEACHERS';

export type FeatureKey =
  | 'attendance'
  | 'timetable'
  | 'exams'
  | 'mcq'
  | 'fee'
  | 'notifications'
  | 'events'
  | 'messaging'
  | 'content'
  | 'report_cards'
  | 'bulk_import'
  | 'parent_portal'
  | 'analytics'
  | 'whatsapp'
  | 'assignments'
  | 'syllabus'
  | 'ptm'
  | 'id_cards';

// API Response
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

// Auth
export interface LoginRequest {
  tenantId: string;
  username: string;
  password: string;
}

export interface SuperAdminLoginRequest {
  username: string;
  password: string;
}

export interface ResolveTenantRequest {
  schoolId: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  featureFlags: Record<string, boolean>;
  user: User;
}

export interface TenantPublicInfo {
  tenantId: string;
  schoolName: string;
  logoUrl: string;
  status: string;
}

// Per-tenant feature toggles attached to /users/me response.
// Used by TenantFeatureService to gate UI (sidebar, SMS pages, badges).
export interface TenantFeatures {
  smsEnabled: boolean;
  smsAbsenceAlertEnabled: boolean;
  smsResultPublishEnabled: boolean;
  smsCustomNoticeEnabled: boolean;
}

// User
export interface User {
  userId: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  profilePhotoUrl?: string;
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt?: string;
  createdAt?: string;

  /** Feature flags scoped to the current user's tenant. Populated only
   *  on /users/me (own profile), not on user-list endpoints. */
  tenantFeatures?: TenantFeatures;
}

// Student
export interface AcademicRecord {
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectIds?: string[];
  active: boolean;
}

export interface Student {
  studentId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  admissionNumber: string;
  rollNumber?: string;
  classId: string;
  sectionId?: string;
  academicYearId: string;
  parentIds: string[];
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  subjectIds?: string[];
  academicRecords?: AcademicRecord[];
  address?: { street: string; city: string; state: string; zip: string };
  createdAt?: string;
}

// Employee / Teacher
export type EmployeeRole = 'TEACHER' | 'ACCOUNTANT' | 'CLERK' | 'PRINCIPAL' | 'HEAD_MISTRESS' | 'LAB_ASSISTANT' | 'NON_TEACHING' | 'COORDINATOR';

export interface ClassSubjectAssignment {
  classId: string;
  sectionId: string;
  subjectId: string;
}

export interface Teacher {
  teacherId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  employeeId: string;
  qualification?: string;
  specialization?: string;
  employeeRole?: EmployeeRole;
  classSubjectAssignments?: ClassSubjectAssignment[];
  classIds: string[];
  subjectIds: string[];
  isClassTeacher?: boolean;
  classTeacher?: boolean;
  classTeacherOfClassId?: string;
  classTeacherOfSectionId?: string;
  assignedClassId?: string;
  dateOfBirth?: string;
  joiningDate?: string;
  joinDate?: string;
}

// SchoolClass
export interface SchoolClass {
  classId: string;
  name: string;
  academicYearId: string;
  sections: { sectionId: string; name: string; capacity: number; classTeacherId?: string; subjectIds?: string[] }[];
  createdAt?: string;
}

// AcademicYear
export interface AcademicYear {
  academicYearId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  current: boolean;
  createdAt?: string;
}

// Exam Type catalog — managed by School Admin, drives every exam-type dropdown
export interface ExamType {
  id: string;
  name: string;
  displayOrder: number;
  defaultMaxMarks?: number;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}

// Notification
export interface Notification {
  notificationId: string;
  title: string;
  body: string;
  type: string;
  channel: string;
  recipientType: string;
  sentAt: string;
  createdBy: string;
}

// WhatsApp
export enum WhatsAppMessageStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_FAILED = 'PARTIALLY_FAILED',
  FAILED = 'FAILED',
}

export enum WhatsAppDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export interface WhatsAppRecipientDetail {
  parentId: string;
  parentName: string;
  phone: string;
  whatsappMessageId?: string;
  deliveryStatus: WhatsAppDeliveryStatus;
  errorMessage?: string;
}

export interface WhatsAppMessage {
  messageId: string;
  sentBy: string;
  sentByName: string;
  recipientType: 'CLASS' | 'INDIVIDUAL';
  classId?: string;
  className?: string;
  parentIds: string[];
  recipients: WhatsAppRecipientDetail[];
  messageBody: string;
  contentType: string;
  mediaUrl?: string;
  mediaFileName?: string;
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  status: WhatsAppMessageStatus;
  createdAt: string;
  completedAt?: string;
}

export interface WhatsAppRecipientInfo {
  parentId: string;
  parentName: string;
  phone: string;
}

export interface SendWhatsAppRequest {
  recipientType: 'CLASS' | 'INDIVIDUAL';
  classId?: string;
  parentIds?: string[];
  messageBody: string;
  mediaUrl?: string;
  mediaFileName?: string;
  mediaMimeType?: string;
}

// Tenant (for super admin)
export interface Tenant {
  tenantId: string;
  schoolName: string;
  subdomain: string;
  status: string;
  contactEmail: string;
  contactPhone?: string;
  plan: string;
  featureFlags: Record<string, boolean>;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  createdAt?: string;
}

export interface CreateTenantRequest {
  schoolName: string;
  subdomain: string;
  contactEmail: string;
  contactPhone?: string;
  plan: string;
  logoUrl?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

// Feature Management
export interface FeatureCatalogItem {
  featureKey: string;
  displayName: string;
  description: string;
  category: string;
  coreFeature: boolean;
  defaultEnabled: boolean;
  sortOrder: number;
  availableInPlans: string[];
}

export interface FeatureDetail {
  featureKey: string;
  displayName: string;
  description: string;
  category: string;
  enabled: boolean;
  coreFeature: boolean;
  availableInPlan: boolean;
}

export interface SchoolFeatureResponse {
  tenantId: string;
  schoolName: string;
  plan: string;
  totalFeatures: number;
  enabledFeatures: number;
  features: FeatureDetail[];
  categories: Record<string, FeatureDetail[]>;
}

export interface FeatureAuditLog {
  id: string;
  tenantId: string;
  featureKey: string;
  featureDisplayName: string;
  previousState: boolean;
  newState: boolean;
  changedBy: string;
  changedByName: string;
  changeReason?: string;
  timestamp: string;
  undone: boolean;
  undoneAt?: string;
}

export interface FeatureTemplate {
  id: string;
  name: string;
  description: string;
  featureFlags: Record<string, boolean>;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface FeatureToggleRequest {
  featureKey: string;
  enabled: boolean;
  reason?: string;
}

export interface BulkFeatureToggleRequest {
  features: Record<string, boolean>;
  reason?: string;
}

// ── Fees ───────────────────────────────────────────────────────────────
export type FeeType = 'TUITION' | 'EXAM' | 'LABORATORY' | 'SPORTS' | 'TRANSPORT' | 'LIBRARY' | 'OTHER';
export type PaymentMode = 'CASH' | 'ONLINE' | 'CHEQUE' | 'DD' | 'OTHER';
export type PaymentStatus = 'PARTIAL' | 'FULL';

export interface FeeStructure {
  feeStructureId: string;
  academicYearId: string;
  classId: string;
  feeType?: FeeType;
  amount: number;
  dueDate?: string;
  description?: string;
  createdAt?: string;
}

export interface FeePayment {
  paymentId: string;
  receiptNumber: string;
  studentId: string;
  classId: string;
  feeStructureId?: string;
  academicYearId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  remarks?: string;
  recordedBy?: string;
  createdAt?: string;
}

export interface StudentFeeDetails {
  studentId: string;
  totalFee: number;
  totalPaid: number;
  pending: number;
  status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'UNPAID' | 'NO_FEE';
  payments: FeePayment[];
  structures: FeeStructure[];
}

// ── Student Fee Ledger (new — one document per student+year) ─────────────
export type LedgerPaymentMode = 'CASH' | 'ONLINE' | 'UPI' | 'CHEQUE' | 'DD' | 'CARD' | 'OTHER';
export type LedgerStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface FeeLedgerPayment {
  paymentId: string;
  receiptNumber: string;
  amount: number;
  mode: LedgerPaymentMode;
  paidAt: string;
  collectedByUserId?: string;
  collectedByName?: string;
  notes?: string;
  voidedAt?: string;
  voidedByUserId?: string;
  voidReason?: string;
  supersededPaymentId?: string;
  createdAt?: string;
}

export interface FeeLedgerCorrection {
  correctionId: string;
  paymentId: string;
  action: 'APPEND' | 'EDIT' | 'VOID';
  reason?: string;
  byUserId?: string;
  at?: string;
}

export interface StudentFeeLedger {
  ledgerId: string;
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  rollNumber?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  academicYearId: string;
  academicYearLabel?: string;
  feeStructureId?: string;
  totalFee: number;
  concession: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  status: LedgerStatus;
  dueDate?: string;
  payments: FeeLedgerPayment[];
  corrections?: FeeLedgerCorrection[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppendPaymentRequest {
  amount: number;
  mode: LedgerPaymentMode;
  paidAt?: string;
  notes?: string;
}

export interface UpdateLedgerPaymentRequest {
  amount: number;
  mode: LedgerPaymentMode;
  paidAt?: string;
  notes?: string;
  reason?: string;
}

export interface VoidPaymentRequest {
  reason?: string;
}

// ── ID Card ─────────────────────────────────────────────────────────────
export interface IdCardRequest {
  userType: 'STUDENT' | 'TEACHER';
  userIds: string[];
}

export interface IdCardResponse {
  downloadUrl: string;
  generatedCount: number;
}

// ── Report Cards ────────────────────────────────────────────────────────
export interface ReportCard {
  reportCardId: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  classId: string;
  className: string;
  sectionName?: string;
  academicYearId: string;
  academicYearLabel: string;
  marks: ReportCardMark[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  rank?: number;
  attendancePercentage?: number;
  remarks?: string;
  downloadUrl?: string;
  generatedAt?: string;
}

export interface ReportCardMark {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  obtainedMarks: number;
  grade: string;
}

/**
 * One slice of a subject's report card row — only present for
 * subjects with multiple components. The report card view groups
 * these under the parent SubjectGrade with a per-component sub-table
 * and a combined total row.
 */
export interface ReportCardComponentGrade {
  key: string;
  label: string;
  marksObtained: number;
  maxMarks: number;
  passMarks: number;
  passed: boolean;
  /** Null when the component isn't attendance-tracked (Internal / Project). */
  attendancePercentage?: number | null;
  /** "EXAM" or "INTERNAL" — surfaces the source on the report. */
  assessmentMode?: 'EXAM' | 'INTERNAL';
}

export interface GenerateReportCardRequest {
  classId: string;
  academicYearId: string;
  studentIds: string[];
}

// ── My Students (teacher view) ──────────────────────────────────────────
export interface MyClassStudentsClass {
  academicYearId?: string;
  academicYearLabel?: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  students: Student[];
}

export interface MyClassStudentsResponse {
  classTeacher: boolean;
  reason?: 'NO_PROFILE' | 'NO_CLASS_TEACHER_ROLE' | string;
  classes: MyClassStudentsClass[];
}

// ── Student profile summary (detail view) ───────────────────────────────
export interface StudentProfileInfo {
  studentId: string;
  name: string;
  admissionNumber?: string;
  rollNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  academicYearId?: string;
  academicYearLabel?: string;
  parentName?: string;
  parentPhone?: string;
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  total: number;
  percentage: number;
}

export interface SubjectAttendance {
  subjectId: string;
  subjectName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export interface AttendanceSummary {
  overall: AttendanceCounts;
  bySubject: SubjectAttendance[];
}

export interface ExamMarkRow {
  examId: string;
  examName: string;
  examType?: string;
  examDate?: string;
  subjectId?: string;
  subjectName?: string;
  marksObtained?: number;
  maxMarks: number;
  passingMarks: number;
  grade?: string;
  isPassed?: boolean;
}

export interface StudentProfileSummary {
  student: StudentProfileInfo;
  attendance: AttendanceSummary;
  exams: ExamMarkRow[];
}

// ── Teacher Subject Assignment ──────────────────────────────────────────
export type TeacherAssignmentRole = 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
export type TeacherAssignmentStatus = 'ACTIVE' | 'ARCHIVED';

export interface TeacherSubjectAssignment {
  assignmentId: string;
  teacherId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId?: string;
  /**
   * Which component of the subject the teacher owns — e.g. "theory"
   * or "practical" on a hybrid subject. Null / undefined for
   * single-component subjects and for CLASS_TEACHER-only assignments.
   */
  componentKey?: string;
  /**
   * Which teaching sub-part of the subject this assignment is for —
   * e.g. "physics" on an integrated Science course. Null / undefined
   * for subjects that don't define sub-parts. Orthogonal to
   * {@link #componentKey} (Theory / Practical / IA).
   */
  subPartKey?: string;
  roles: TeacherAssignmentRole[];
  status: TeacherAssignmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTeacherAssignmentRequest {
  teacherId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId?: string;
  /** Required when the subject has multiple components and the role is SUBJECT_TEACHER. */
  componentKey?: string;
  /** Optional. Set when the subject defines sub-parts (e.g. Physics /
   *  Chemistry / Biology under Science) and this assignment is scoped
   *  to one of them. */
  subPartKey?: string;
  roles: TeacherAssignmentRole[];
}

export interface CarryForwardAssignmentsRequest {
  fromAcademicYearId: string;
  toAcademicYearId: string;
  teacherIds?: string[];
  skipExisting?: boolean;
}

export interface CarryForwardResult {
  fromYearLabel: string;
  toYearLabel: string;
  scanned: number;
  copied: number;
  skippedDuplicate: number;
  skippedNoMatchingClass: number;
  skippedNoMatchingSection: number;
  skippedNoMatchingSubject: number;
  skippedMissingClass: number;
  warnings: string[];
}

// ── Syllabus Tracker ────────────────────────────────────────────────────
export type SyllabusTopicStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface SyllabusTopic {
  topicId: string;
  topicName: string;
  description?: string;
  plannedDate?: string;
  completionDate?: string;
  status: SyllabusTopicStatus;
  completionPercentage: number;
}

export interface Syllabus {
  syllabusId: string;
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  subjectId: string;
  subjectName: string;
  academicYearId: string;
  academicYearLabel: string;
  teacherId?: string;
  teacherName?: string;
  topics: SyllabusTopic[];
  totalTopics: number;
  completedTopics: number;
  progressPercentage: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSyllabusRequest {
  classId: string;
  sectionId?: string;
  subjectId: string;
  subjectName?: string;
  academicYearId: string;
  topics: { topicId?: string; topicName: string; description?: string; plannedDate?: string }[];
}

export interface UpdateTopicStatusRequest {
  topicId: string;
  status: SyllabusTopicStatus;
  completionPercentage: number;
}

// ── Assignments ─────────────────────────────────────────────────────────
export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'LATE' | 'GRADED';

export interface Assignment {
  assignmentId: string;
  title: string;
  description?: string;
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dueDate: string;
  maxMarks: number;
  fileUrl?: string;
  fileName?: string;
  status: AssignmentStatus;
  submissionsCount: number;
  totalStudents: number;
  createdAt: string;
}

export interface AssignmentSubmission {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  submittedAt?: string;
  fileUrl?: string;
  fileName?: string;
  answer?: string;
  marks?: number;
  feedback?: string;
  status: SubmissionStatus;
}

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  dueDate: string;
  maxMarks: number;
}

export interface GradeSubmissionRequest {
  marks: number;
  feedback?: string;
}

// ── Performance Analytics ───────────────────────────────────────────────
export interface PerformanceTrend {
  examName: string;
  examDate: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
}

export interface SubjectAnalysis {
  subjectId: string;
  subjectName: string;
  averageMarks: number;
  maxMarks: number;
  percentage: number;
}

export interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  className: string;
  trends: PerformanceTrend[];
  subjectAnalysis: SubjectAnalysis[];
  gradeDistribution: GradeDistribution[];
  overallPercentage: number;
  rank?: number;
  strengths: string[];
  areasToImprove: string[];
}

export interface ClassRanking {
  rank: number;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  obtainedMarks: number;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
}

// ── PTM (Parent-Teacher Meeting) ────────────────────────────────────────
export type PtmStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type PtmSlotStatus = 'AVAILABLE' | 'BOOKED' | 'COMPLETED' | 'CANCELLED';

export interface PtmMeeting {
  ptmId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  location?: string;
  status: PtmStatus;
  totalSlots: number;
  bookedSlots: number;
  teacherIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface PtmSlot {
  slotId: string;
  ptmId: string;
  teacherId: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  status: PtmSlotStatus;
  parentId?: string;
  parentName?: string;
  studentId?: string;
  studentName?: string;
}

export interface CreatePtmRequest {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  location?: string;
  teacherIds: string[];
}

export interface BookPtmSlotRequest {
  slotId: string;
  studentId: string;
}

// ── Events & Holidays ─────────────────────────────────────────────────
export type EventType = 'CULTURAL' | 'SPORTS' | 'ACADEMIC' | 'HOLIDAY' | 'MEETING' | 'OTHER';
export type RecurrencePattern = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface SchoolEvent {
  eventId: string;
  title: string;
  description?: string;
  createdBy?: string;
  type: EventType;
  startDate: string;
  endDate: string;
  isHoliday: boolean;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  visibleTo?: string[];
  // Derived on save from startDate — lets us filter by academic year / month.
  academicYearId?: string;
  year?: number;
  month?: number;
  createdAt?: string;
}

// ── Timetable ──────────────────────────────────────────────────────────
export interface TimetablePeriod {
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  roomNumber: string;
  /**
   * For hybrid subjects with multiple attendance-tracked components
   * (e.g. Math: Theory + Practical) the timetable slot itself declares
   * which slice this period is for. Empty when the subject has a single
   * component or no slice was chosen at timetable time.
   */
  componentKey?: string;
  componentLabel?: string;
  /**
   * Teaching-side slice — set when the subject defines sub-parts
   * (Physics / Chemistry / Biology under an integrated Science course)
   * and this period is for one of them. Drives the attendance routing
   * downstream so the right teacher's attendance form scopes to the
   * right sub-part. Empty for subjects without sub-parts.
   */
  subPartKey?: string;
  subPartLabel?: string;
  /**
   * Free-text label for activity slots (Reading, Writing, Library, PE,
   * Assembly...). When set, subjectId / teacherId may be empty — the
   * slot is a supervised activity, not a teaching period. Downstream
   * flows (attendance, exams, report cards) key off subjectId and
   * naturally skip activity slots.
   */
  activityLabel?: string;
}

export interface TimetableDaySchedule {
  dayOfWeek: string;
  periods: TimetablePeriod[];
}

/** Per-timetable schedule shape — controls where lunch sits, what time
 *  periods start, and how times render to admins and parents. Optional
 *  on the wire (null on legacy timetables saved before this field
 *  existed); the builder substitutes sensible defaults when missing. */
export interface ScheduleConfig {
  firstPeriodStart?: string;       // "HH:mm" 24-hour, default "08:00"
  periodDurationMinutes?: number;  // default 45
  periodsBeforeLunch?: number;     // 0 = no lunch row, default 4
  lunchStart?: string;             // "HH:mm" 24-hour, default "11:00"
  lunchEnd?: string;               // "HH:mm" 24-hour, default "11:30"
  displayTimeFormat?: 'h12' | 'h24'; // default 'h12' (renders "1:00 PM")
  /** Number of periods for this day/schedule. Optional — only meaningful
   *  inside a per-day override where a day might have fewer periods
   *  (Saturday commonly has 4 instead of 7). Falls back to
   *  periodsBeforeLunch + 4 when unset. */
  periodsCount?: number;
  /** Optional per-day override. Key is uppercase day name (MONDAY..SATURDAY);
   *  the value replaces the outer config for that day only. Saturday commonly
   *  runs shorter hours, fewer periods, earlier lunch — set an override for
   *  it without touching Mon–Fri. Legacy timetables have this undefined.
   *  Values are marked possibly-undefined so a keyed lookup at runtime
   *  narrows cleanly. */
  perDayOverrides?: { [dayOfWeek: string]: ScheduleConfig | undefined };
}

export interface Timetable {
  timetableId: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  academicYearId: string;
  schedule: TimetableDaySchedule[];
  scheduleConfig?: ScheduleConfig;
  createdAt?: string;
}
