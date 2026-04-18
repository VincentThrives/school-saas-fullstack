// Enums
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  PRINCIPAL = 'PRINCIPAL',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
}

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
export type EmployeeRole = 'TEACHER' | 'ACCOUNTANT' | 'CLERK' | 'PRINCIPAL' | 'HEAD_MISTRESS' | 'LAB_ASSISTANT' | 'NON_TEACHING';

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

export interface GenerateReportCardRequest {
  classId: string;
  academicYearId: string;
  studentIds: string[];
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
  subjectId: string;
  academicYearId: string;
  topics: { topicName: string; description?: string; plannedDate?: string }[];
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
}

export interface TimetableDaySchedule {
  dayOfWeek: string;
  periods: TimetablePeriod[];
}

export interface Timetable {
  timetableId: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  academicYearId: string;
  schedule: TimetableDaySchedule[];
  createdAt?: string;
}
