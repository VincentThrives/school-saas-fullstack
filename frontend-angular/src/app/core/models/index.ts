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
  | 'whatsapp';

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
export interface Student {
  studentId: string;
  userId: string;
  admissionNumber: string;
  rollNumber?: string;
  classId: string;
  sectionId?: string;
  academicYearId: string;
  parentIds: string[];
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  address?: { street: string; city: string; state: string; zip: string };
  createdAt?: string;
}

// Teacher
export interface Teacher {
  teacherId: string;
  userId: string;
  employeeId: string;
  qualification?: string;
  specialization?: string;
  classIds: string[];
  subjectIds: string[];
  isClassTeacher: boolean;
  assignedClassId?: string;
  joinDate?: string;
}

// SchoolClass
export interface SchoolClass {
  id: string;
  name: string;
  academicYearId: string;
  sections: { name: string; capacity: number; sectionId?: string }[];
}

// AcademicYear
export interface AcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
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
