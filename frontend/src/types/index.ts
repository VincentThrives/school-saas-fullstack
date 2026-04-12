// ==========================================
// School Management SaaS - TypeScript Types
// ==========================================

// Enums
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  PRINCIPAL = 'PRINCIPAL',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  HOLIDAY = 'HOLIDAY',
}

export enum EventType {
  CULTURAL = 'CULTURAL',
  SPORTS = 'SPORTS',
  ACADEMIC = 'ACADEMIC',
  HOLIDAY = 'HOLIDAY',
  OTHER = 'OTHER',
}

export enum NotificationType {
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  EXAM = 'EXAM',
  ATTENDANCE = 'ATTENDANCE',
  FEE = 'FEE',
  GENERAL = 'GENERAL',
  ALERT = 'ALERT',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH',
}

export enum SubjectType {
  THEORY = 'THEORY',
  PRACTICAL = 'PRACTICAL',
  ELECTIVE = 'ELECTIVE',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum AcademicYearStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum MentoringCategory {
  ACADEMIC = 'ACADEMIC',
  BEHAVIORAL = 'BEHAVIORAL',
  ATTENDANCE = 'ATTENDANCE',
  HEALTH = 'HEALTH',
  OTHER = 'OTHER',
}

export enum SubscriptionPlan {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  ENTERPRISE = 'ENTERPRISE',
}

// Base interfaces
export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
}

export interface Document {
  name: string;
  url: string;
}

// API Response wrapper
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

// Auth types
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

export interface ResolveTenantResponse {
  tenantId: string;
  schoolName: string;
  logoUrl: string;
  status: TenantStatus;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  role: UserRole;
  featureFlags: Record<string, boolean>;
}

export interface DecodedToken {
  userId: string;
  tenantId?: string;
  role: UserRole;
  featureFlags: Record<string, boolean>;
  iat: number;
  exp: number;
}

// Feature flags
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
  | 'whatsapp';

export interface FeatureCatalog {
  featureKey: FeatureKey;
  displayName: string;
  description: string;
  defaultEnabled: boolean;
  availableInPlans: SubscriptionPlan[];
}

// Tenant types
export interface Tenant {
  tenantId: string;
  schoolName: string;
  subdomain: string;
  customDomain?: string;
  databaseName: string;
  status: TenantStatus;
  contactEmail: string;
  contactPhone: string;
  address: Address;
  logoUrl: string;
  plan: SubscriptionPlan;
  featureFlags: Record<FeatureKey, boolean>;
  limits: {
    maxStudents: number;
    maxUsers: number;
    storageGb: number;
  };
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
  suspendReason?: string;
}

// User types
export interface User {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  profilePhotoUrl?: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePhotoUrl?: string;
}

// Academic Year
export interface AcademicYear {
  academicYearId: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: AcademicYearStatus;
}

// Class & Section
export interface Class {
  classId: string;
  name: string;
  grade: number;
  academicYearId: string;
  sections: Section[];
  createdAt: string;
}

export interface Section {
  sectionId: string;
  classId: string;
  name: string;
  classTeacherId?: string;
  classTeacherName?: string;
  capacity: number;
  studentCount: number;
}

// Subject
export interface Subject {
  subjectId: string;
  name: string;
  code: string;
  type: SubjectType;
  classIds: string[];
  createdAt: string;
}

export interface SubjectAssignment {
  subjectId: string;
  classId: string;
  sectionId: string;
  teacherId: string;
  teacherName: string;
}

// Student
export interface Student {
  studentId: string;
  userId: string;
  user?: User;
  rollNumber: string;
  admissionNumber: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  parentIds: string[];
  parents?: Parent[];
  dateOfBirth: string;
  gender: Gender;
  bloodGroup?: string;
  address: Address;
  academicHistory: AcademicHistoryEntry[];
  documents: Document[];
  createdAt: string;
}

export interface AcademicHistoryEntry {
  academicYearId: string;
  classId: string;
  result: string;
}

export interface CreateStudentRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  rollNumber: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup?: string;
  address: Address;
}

// Teacher
export interface Teacher {
  teacherId: string;
  userId: string;
  user?: User;
  employeeId: string;
  qualification: string;
  specialization: string;
  subjectIds: string[];
  subjects?: Subject[];
  classIds: string[];
  sectionIds: string[];
  isClassTeacher: boolean;
  classTeacherOf?: {
    classId: string;
    sectionId: string;
    className?: string;
    sectionName?: string;
  };
  joiningDate: string;
  documents: Document[];
}

export interface CreateTeacherRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  employeeId: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
}

// Parent
export interface Parent {
  parentId: string;
  userId: string;
  user?: User;
  childrenIds: string[];
  children?: Student[];
  relationship: string;
}

// Attendance
export interface Attendance {
  attendanceId: string;
  studentId: string;
  student?: Student;
  classId: string;
  sectionId: string;
  academicYearId: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string;
  markedByName?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkAttendanceRequest {
  classId: string;
  sectionId: string;
  date: string;
  attendances: {
    studentId: string;
    status: AttendanceStatus;
    remarks?: string;
  }[];
}

export interface AttendanceSummary {
  studentId: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  percentage: number;
}

// Timetable
export interface TimetableEntry {
  entryId: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  periodNumber: number;
  startTime: string;
  endTime: string;
  room?: string;
}

// Events & Holidays
export interface SchoolEvent {
  eventId: string;
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
  isHoliday: boolean;
  isRecurring: boolean;
  recurrencePattern?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  visibleTo: ('ALL' | UserRole)[];
  description: string;
  createdBy: string;
  createdAt: string;
}

// Exams
export interface Exam {
  examId: string;
  name: string;
  academicYearId: string;
  classIds: string[];
  subjectId: string;
  subjectName?: string;
  date: string;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passingMarks: number;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
}

export interface ExamMark {
  markId: string;
  examId: string;
  studentId: string;
  student?: Student;
  marksObtained: number;
  grade?: string;
  remarks?: string;
  enteredBy: string;
  enteredAt: string;
  isLocked: boolean;
}

// MCQ
export interface McqQuestion {
  questionId: string;
  subjectId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  createdBy: string;
  createdAt: string;
}

export interface McqExam {
  examId: string;
  title: string;
  subjectId: string;
  subjectName?: string;
  classIds: string[];
  questionIds: string[];
  questions?: McqQuestion[];
  duration: number; // in minutes
  startTime: string;
  endTime: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  allowRetake: boolean;
  allowBackNavigation: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
}

export interface McqAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  answers: {
    questionId: string;
    selectedOptionIndex: number;
  }[];
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  startedAt: string;
  submittedAt?: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TIMED_OUT';
}

// Mentoring Notes
export interface MentoringNote {
  noteId: string;
  studentId: string;
  teacherId: string;
  teacherName?: string;
  note: string;
  category: MentoringCategory;
  isFlagged: boolean;
  createdAt: string;
}

// Notifications
export interface Notification {
  notificationId: string;
  title: string;
  body: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientType: 'ALL' | 'ROLE' | 'CLASS' | 'INDIVIDUAL';
  recipientRole?: UserRole;
  recipientClassId?: string;
  recipientIds?: string[];
  readBy: string[];
  sentAt: string;
  createdBy: string;
}

// Fees
export interface FeeStructure {
  feeStructureId: string;
  academicYearId: string;
  classId: string;
  className?: string;
  feeType: string;
  amount: number;
  dueDate: string;
  description?: string;
  createdAt: string;
}

export interface FeePayment {
  paymentId: string;
  studentId: string;
  student?: Student;
  feeStructureId: string;
  feeStructure?: FeeStructure;
  amountPaid: number;
  paymentDate: string;
  paymentMode: 'CASH' | 'CHEQUE' | 'ONLINE' | 'BANK_TRANSFER';
  receiptNumber: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
}

export interface FeeStatus {
  studentId: string;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  payments: FeePayment[];
}

// Settings
export interface SchoolSettings {
  settingsId: string;
  tenantId: string;
  admissionNumberFormat: string;
  rollNumberFormat: 'NUMERIC' | 'ALPHANUMERIC' | 'CUSTOM';
  employeeIdFormat: string;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireSpecialChar: boolean;
    expiryDays: number;
  };
  attendanceWindowHours: number;
  lateThresholdMinutes: number;
  defaultPassingMarksPercent: number;
  feeGracePeriodDays: number;
  maxLoginAttempts: number;
  sessionTimeoutMinutes: number;
}

// Dashboard Stats
export interface SuperAdminStats {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalStudents: number;
  newTenantsThisMonth: number;
  storageUsedGb: number;
}

export interface SchoolAdminStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceRateToday: number;
  upcomingExams: number;
  feeCollectionThisMonth: number;
  pendingFees: number;
  recentNotifications: number;
}

export interface PrincipalStats {
  attendanceRateToday: number;
  attendanceRateMonth: number;
  topPerformers: Student[];
  lowPerformers: Student[];
  upcomingExams: Exam[];
  feeCollectionRate: number;
  teacherComplianceRate: number;
}

export interface TeacherStats {
  assignedClasses: number;
  assignedStudents: number;
  pendingAttendance: boolean;
  upcomingExams: Exam[];
  recentMessages: number;
}

export interface StudentStats {
  attendancePercentage: number;
  recentMarks: ExamMark[];
  upcomingMcqExams: McqExam[];
  unreadNotifications: number;
}

export interface ParentStats {
  childAttendance: AttendanceSummary;
  recentMarks: ExamMark[];
  feeStatus: FeeStatus;
  schoolAnnouncements: Notification[];
}

// Audit Log
export interface AuditLog {
  logId: string;
  tenantId?: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

// Report Card
export interface ReportCard {
  studentId: string;
  student: Student;
  academicYearId: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  exams: {
    examId: string;
    examName: string;
    subjects: {
      subjectId: string;
      subjectName: string;
      maxMarks: number;
      marksObtained: number;
      grade: string;
    }[];
    totalMarks: number;
    obtainedMarks: number;
    percentage: number;
    rank: number;
  }[];
  attendance: AttendanceSummary;
  teacherRemarks?: string;
  principalRemarks?: string;
}

// Study Materials
export interface StudyMaterial {
  materialId: string;
  title: string;
  description: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
}

// Messages
export interface Message {
  messageId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  receiverId: string;
  receiverName: string;
  receiverRole: UserRole;
  subject: string;
  body: string;
  isRead: boolean;
  sentAt: string;
  readAt?: string;
}

// Bulk Import
export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: {
    row: number;
    field: string;
    message: string;
  }[];
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

export enum WhatsAppContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
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
  contentType: WhatsAppContentType;
  mediaUrl?: string;
  mediaFileName?: string;
  mediaMimeType?: string;
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
