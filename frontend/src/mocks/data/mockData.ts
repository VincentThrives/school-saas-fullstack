import { UserRole, TenantStatus, SubscriptionPlan, Gender, AttendanceStatus, EventType, SubjectType, AcademicYearStatus, NotificationType, NotificationChannel, MentoringCategory } from '../../types';

// ==================== Mock Users (6 Key Users) ====================
export const mockUsers = {
  superAdmin: {
    userId: 'super-admin-001',
    tenantId: '',
    email: 'admin@schoolsaas.com',
    role: UserRole.SUPER_ADMIN,
    firstName: 'Rajesh',
    lastName: 'Kapoor',
    phone: '+919800000001',
    profilePhotoUrl: '',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  schoolAdmin: {
    userId: 'user-001',
    tenantId: 'tenant-001',
    email: 'admin@greenwood.edu',
    role: UserRole.SCHOOL_ADMIN,
    firstName: 'Vikram',
    lastName: 'Mehta',
    phone: '+919800000002',
    profilePhotoUrl: '',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  principal: {
    userId: 'user-002',
    tenantId: 'tenant-001',
    email: 'principal@greenwood.edu',
    role: UserRole.PRINCIPAL,
    firstName: 'Sunita',
    lastName: 'Deshmukh',
    phone: '+919800000003',
    profilePhotoUrl: '',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  teacher: {
    userId: 'user-003',
    tenantId: 'tenant-001',
    email: 'teacher@greenwood.edu',
    role: UserRole.TEACHER,
    firstName: 'Ramesh',
    lastName: 'Iyer',
    phone: '+919800000004',
    profilePhotoUrl: '',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  student: {
    userId: 'user-004',
    tenantId: 'tenant-001',
    email: 'student@greenwood.edu',
    role: UserRole.STUDENT,
    firstName: 'Aarav',
    lastName: 'Sharma',
    phone: '+919800000005',
    profilePhotoUrl: '',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  parent: {
    userId: 'user-005',
    tenantId: 'tenant-001',
    email: 'parent@greenwood.edu',
    role: UserRole.PARENT,
    firstName: 'Manoj',
    lastName: 'Sharma',
    phone: '+919800000006',
    profilePhotoUrl: '',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
};

// ==================== Mock Tenants (5 Total) ====================
export const mockTenants = [
  {
    tenantId: 'tenant-001',
    schoolName: 'Greenwood Academy',
    subdomain: 'greenwood',
    databaseName: 'school_tenant_001',
    status: TenantStatus.ACTIVE,
    contactEmail: 'admin@greenwood.edu',
    contactPhone: '+919800000002',
    address: { street: '12, MG Road', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411001' },
    logoUrl: '',
    plan: SubscriptionPlan.ENTERPRISE,
    featureFlags: {
      attendance: true, timetable: true, exams: true, mcq: true, fee: true,
      notifications: true, events: true, messaging: true, content: true,
      report_cards: true, bulk_import: true, parent_portal: true, analytics: true,
    },
    limits: { maxStudents: 3000, maxUsers: 150, storageGb: 50 },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    tenantId: 'tenant-002',
    schoolName: 'Delhi Public School, Vasant Kunj',
    subdomain: 'dpsvasantkunj',
    databaseName: 'school_tenant_002',
    status: TenantStatus.ACTIVE,
    contactEmail: 'admin@dpsvk.edu.in',
    contactPhone: '+919811000001',
    address: { street: 'Sector C, Vasant Kunj', city: 'New Delhi', state: 'Delhi', country: 'India', zip: '110070' },
    logoUrl: '',
    plan: SubscriptionPlan.ENTERPRISE,
    featureFlags: {
      attendance: true, timetable: true, exams: true, mcq: true, fee: true,
      notifications: true, events: true, messaging: true, content: true,
      report_cards: true, bulk_import: true, parent_portal: true, analytics: true,
    },
    limits: { maxStudents: 5000, maxUsers: 250, storageGb: 100 },
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    tenantId: 'tenant-003',
    schoolName: 'Kendriya Vidyalaya No. 2',
    subdomain: 'kv2bangalore',
    databaseName: 'school_tenant_003',
    status: TenantStatus.ACTIVE,
    contactEmail: 'admin@kv2blr.edu.in',
    contactPhone: '+919845000001',
    address: { street: 'HAL Airport Road', city: 'Bengaluru', state: 'Karnataka', country: 'India', zip: '560017' },
    logoUrl: '',
    plan: SubscriptionPlan.STANDARD,
    featureFlags: {
      attendance: true, timetable: true, exams: true, mcq: false, fee: true,
      notifications: true, events: true, messaging: false, content: true,
      report_cards: true, bulk_import: false, parent_portal: true, analytics: false,
    },
    limits: { maxStudents: 1500, maxUsers: 80, storageGb: 25 },
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    tenantId: 'tenant-004',
    schoolName: 'Ryan International School',
    subdomain: 'ryanmumbai',
    databaseName: 'school_tenant_004',
    status: TenantStatus.SUSPENDED,
    contactEmail: 'admin@ryanmumbai.edu.in',
    contactPhone: '+919820000001',
    address: { street: '45, Andheri West', city: 'Mumbai', state: 'Maharashtra', country: 'India', zip: '400058' },
    logoUrl: '',
    plan: SubscriptionPlan.BASIC,
    featureFlags: {
      attendance: true, timetable: true, exams: true, mcq: false, fee: true,
      notifications: true, events: false, messaging: false, content: false,
      report_cards: false, bulk_import: false, parent_portal: false, analytics: false,
    },
    limits: { maxStudents: 500, maxUsers: 30, storageGb: 10 },
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
    suspendedAt: '2024-06-15T00:00:00Z',
    suspendReason: 'Payment overdue for 3 months',
  },
  {
    tenantId: 'tenant-005',
    schoolName: 'St. Xavier\'s High School',
    subdomain: 'xaviershyd',
    databaseName: 'school_tenant_005',
    status: TenantStatus.INACTIVE,
    contactEmail: 'admin@xaviershyd.edu.in',
    contactPhone: '+919870000001',
    address: { street: 'Banjara Hills, Road No. 10', city: 'Hyderabad', state: 'Telangana', country: 'India', zip: '500034' },
    logoUrl: '',
    plan: SubscriptionPlan.STANDARD,
    featureFlags: {
      attendance: true, timetable: true, exams: true, mcq: true, fee: true,
      notifications: true, events: true, messaging: true, content: false,
      report_cards: true, bulk_import: true, parent_portal: true, analytics: false,
    },
    limits: { maxStudents: 1000, maxUsers: 60, storageGb: 20 },
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
];

// ==================== Mock Academic Years ====================
export const mockAcademicYears = [
  { academicYearId: 'ay-001', label: '2024-2025', startDate: '2024-04-01', endDate: '2025-03-31', isCurrent: true, status: AcademicYearStatus.ACTIVE },
  { academicYearId: 'ay-002', label: '2023-2024', startDate: '2023-04-01', endDate: '2024-03-31', isCurrent: false, status: AcademicYearStatus.ARCHIVED },
];

// ==================== Mock Classes (Grade 5 - Grade 10, Sections A & B) ====================
export const mockClasses = [
  {
    classId: 'class-001', name: 'Grade 10', grade: 10, academicYearId: 'ay-001',
    sections: [
      { sectionId: 'sec-001', classId: 'class-001', name: 'A', classTeacherId: 'user-003', classTeacherName: 'Ramesh Iyer', capacity: 40, studentCount: 38 },
      { sectionId: 'sec-002', classId: 'class-001', name: 'B', classTeacherId: 'user-006', classTeacherName: 'Priya Nair', capacity: 40, studentCount: 36 },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    classId: 'class-002', name: 'Grade 9', grade: 9, academicYearId: 'ay-001',
    sections: [
      { sectionId: 'sec-003', classId: 'class-002', name: 'A', classTeacherId: 'user-007', classTeacherName: 'Anjali Gupta', capacity: 40, studentCount: 40 },
      { sectionId: 'sec-004', classId: 'class-002', name: 'B', classTeacherId: 'user-008', classTeacherName: 'Deepak Joshi', capacity: 40, studentCount: 37 },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    classId: 'class-003', name: 'Grade 8', grade: 8, academicYearId: 'ay-001',
    sections: [
      { sectionId: 'sec-005', classId: 'class-003', name: 'A', classTeacherId: 'user-009', classTeacherName: 'Kavita Reddy', capacity: 45, studentCount: 42 },
      { sectionId: 'sec-006', classId: 'class-003', name: 'B', classTeacherId: null, classTeacherName: null, capacity: 45, studentCount: 40 },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    classId: 'class-004', name: 'Grade 7', grade: 7, academicYearId: 'ay-001',
    sections: [
      { sectionId: 'sec-007', classId: 'class-004', name: 'A', classTeacherId: 'user-010', classTeacherName: 'Suresh Pillai', capacity: 40, studentCount: 39 },
      { sectionId: 'sec-008', classId: 'class-004', name: 'B', classTeacherId: null, classTeacherName: null, capacity: 40, studentCount: 35 },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    classId: 'class-005', name: 'Grade 6', grade: 6, academicYearId: 'ay-001',
    sections: [
      { sectionId: 'sec-009', classId: 'class-005', name: 'A', classTeacherId: null, classTeacherName: null, capacity: 45, studentCount: 43 },
      { sectionId: 'sec-010', classId: 'class-005', name: 'B', classTeacherId: null, classTeacherName: null, capacity: 45, studentCount: 41 },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    classId: 'class-006', name: 'Grade 5', grade: 5, academicYearId: 'ay-001',
    sections: [
      { sectionId: 'sec-011', classId: 'class-006', name: 'A', classTeacherId: null, classTeacherName: null, capacity: 45, studentCount: 44 },
      { sectionId: 'sec-012', classId: 'class-006', name: 'B', classTeacherId: null, classTeacherName: null, capacity: 45, studentCount: 42 },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// ==================== Mock Subjects (8 Subjects) ====================
export const mockSubjects = [
  { subjectId: 'sub-001', name: 'Mathematics', code: 'MATH', type: SubjectType.THEORY, classIds: ['class-001', 'class-002', 'class-003', 'class-004', 'class-005', 'class-006'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-002', name: 'Science', code: 'SCI', type: SubjectType.THEORY, classIds: ['class-001', 'class-002', 'class-003', 'class-004', 'class-005', 'class-006'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-003', name: 'English', code: 'ENG', type: SubjectType.THEORY, classIds: ['class-001', 'class-002', 'class-003', 'class-004', 'class-005', 'class-006'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-004', name: 'Hindi', code: 'HIN', type: SubjectType.THEORY, classIds: ['class-001', 'class-002', 'class-003', 'class-004', 'class-005', 'class-006'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-005', name: 'Social Studies', code: 'SST', type: SubjectType.THEORY, classIds: ['class-001', 'class-002', 'class-003', 'class-004', 'class-005', 'class-006'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-006', name: 'Computer Science', code: 'CS', type: SubjectType.THEORY, classIds: ['class-001', 'class-002', 'class-003'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-007', name: 'Physics Lab', code: 'PHY-LAB', type: SubjectType.PRACTICAL, classIds: ['class-001', 'class-002'], createdAt: '2024-01-01T00:00:00Z' },
  { subjectId: 'sub-008', name: 'Art', code: 'ART', type: SubjectType.ELECTIVE, classIds: ['class-003', 'class-004', 'class-005', 'class-006'], createdAt: '2024-01-01T00:00:00Z' },
];

// ==================== Mock Users List (25+ Users) ====================
export const mockUsersList = [
  // user-001 to user-005 from mockUsers
  mockUsers.schoolAdmin,
  mockUsers.principal,
  mockUsers.teacher,
  mockUsers.student,
  mockUsers.parent,
  // Additional Teachers (user-006 to user-010)
  { userId: 'user-006', tenantId: 'tenant-001', email: 'priya.nair@greenwood.edu', role: UserRole.TEACHER, firstName: 'Priya', lastName: 'Nair', phone: '+919800000007', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-22T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-007', tenantId: 'tenant-001', email: 'anjali.gupta@greenwood.edu', role: UserRole.TEACHER, firstName: 'Anjali', lastName: 'Gupta', phone: '+919800000008', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-23T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-008', tenantId: 'tenant-001', email: 'deepak.joshi@greenwood.edu', role: UserRole.TEACHER, firstName: 'Deepak', lastName: 'Joshi', phone: '+919800000009', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-24T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-009', tenantId: 'tenant-001', email: 'kavita.reddy@greenwood.edu', role: UserRole.TEACHER, firstName: 'Kavita', lastName: 'Reddy', phone: '+919800000010', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-25T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-010', tenantId: 'tenant-001', email: 'suresh.pillai@greenwood.edu', role: UserRole.TEACHER, firstName: 'Suresh', lastName: 'Pillai', phone: '+919800000011', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-26T00:00:00Z', updatedAt: new Date().toISOString() },
  // Additional Students (user-011 to user-030)
  { userId: 'user-011', tenantId: 'tenant-001', email: 'meera.patel@greenwood.edu', role: UserRole.STUDENT, firstName: 'Meera', lastName: 'Patel', phone: '+919800000012', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-02T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-012', tenantId: 'tenant-001', email: 'rohan.singh@greenwood.edu', role: UserRole.STUDENT, firstName: 'Rohan', lastName: 'Singh', phone: '+919800000013', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-02T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-013', tenantId: 'tenant-001', email: 'ananya.das@greenwood.edu', role: UserRole.STUDENT, firstName: 'Ananya', lastName: 'Das', phone: '+919800000014', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-03T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-014', tenantId: 'tenant-001', email: 'arjun.kumar@greenwood.edu', role: UserRole.STUDENT, firstName: 'Arjun', lastName: 'Kumar', phone: '+919800000015', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-03T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-015', tenantId: 'tenant-001', email: 'ishita.verma@greenwood.edu', role: UserRole.STUDENT, firstName: 'Ishita', lastName: 'Verma', phone: '+919800000016', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-04T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-016', tenantId: 'tenant-001', email: 'karan.malhotra@greenwood.edu', role: UserRole.STUDENT, firstName: 'Karan', lastName: 'Malhotra', phone: '+919800000017', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-05T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-017', tenantId: 'tenant-001', email: 'divya.rajput@greenwood.edu', role: UserRole.STUDENT, firstName: 'Divya', lastName: 'Rajput', phone: '+919800000018', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-06T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-018', tenantId: 'tenant-001', email: 'vivek.choudhary@greenwood.edu', role: UserRole.STUDENT, firstName: 'Vivek', lastName: 'Choudhary', phone: '+919800000019', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-07T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-019', tenantId: 'tenant-001', email: 'neha.banerjee@greenwood.edu', role: UserRole.STUDENT, firstName: 'Neha', lastName: 'Banerjee', phone: '+919800000020', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-08T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-020', tenantId: 'tenant-001', email: 'siddharth.mishra@greenwood.edu', role: UserRole.STUDENT, firstName: 'Siddharth', lastName: 'Mishra', phone: '+919800000021', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-09T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-021', tenantId: 'tenant-001', email: 'pooja.agarwal@greenwood.edu', role: UserRole.STUDENT, firstName: 'Pooja', lastName: 'Agarwal', phone: '+919800000022', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-10T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-022', tenantId: 'tenant-001', email: 'aditya.tiwari@greenwood.edu', role: UserRole.STUDENT, firstName: 'Aditya', lastName: 'Tiwari', phone: '+919800000023', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-10T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-023', tenantId: 'tenant-001', email: 'riya.saxena@greenwood.edu', role: UserRole.STUDENT, firstName: 'Riya', lastName: 'Saxena', phone: '+919800000024', profilePhotoUrl: '', isActive: false, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-11T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-024', tenantId: 'tenant-001', email: 'harsh.pandey@greenwood.edu', role: UserRole.STUDENT, firstName: 'Harsh', lastName: 'Pandey', phone: '+919800000025', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-12T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-025', tenantId: 'tenant-001', email: 'sneha.chatterjee@greenwood.edu', role: UserRole.STUDENT, firstName: 'Sneha', lastName: 'Chatterjee', phone: '+919800000026', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-13T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-026', tenantId: 'tenant-001', email: 'rahul.bhat@greenwood.edu', role: UserRole.STUDENT, firstName: 'Rahul', lastName: 'Bhat', phone: '+919800000027', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-14T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-027', tenantId: 'tenant-001', email: 'tanvi.jain@greenwood.edu', role: UserRole.STUDENT, firstName: 'Tanvi', lastName: 'Jain', phone: '+919800000028', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-15T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-028', tenantId: 'tenant-001', email: 'dev.kulkarni@greenwood.edu', role: UserRole.STUDENT, firstName: 'Dev', lastName: 'Kulkarni', phone: '+919800000029', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-16T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-029', tenantId: 'tenant-001', email: 'nisha.rao@greenwood.edu', role: UserRole.STUDENT, firstName: 'Nisha', lastName: 'Rao', phone: '+919800000030', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-17T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-030', tenantId: 'tenant-001', email: 'kabir.ahuja@greenwood.edu', role: UserRole.STUDENT, firstName: 'Kabir', lastName: 'Ahuja', phone: '+919800000031', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-18T00:00:00Z', updatedAt: new Date().toISOString() },
  // Additional Parents (user-031 to user-035)
  { userId: 'user-031', tenantId: 'tenant-001', email: 'parent.patel@greenwood.edu', role: UserRole.PARENT, firstName: 'Bhavesh', lastName: 'Patel', phone: '+919800000032', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-02T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-032', tenantId: 'tenant-001', email: 'parent.singh@greenwood.edu', role: UserRole.PARENT, firstName: 'Gurpreet', lastName: 'Singh', phone: '+919800000033', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-02T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-033', tenantId: 'tenant-001', email: 'parent.das@greenwood.edu', role: UserRole.PARENT, firstName: 'Subhash', lastName: 'Das', phone: '+919800000034', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-03T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-034', tenantId: 'tenant-001', email: 'parent.kumar@greenwood.edu', role: UserRole.PARENT, firstName: 'Ashok', lastName: 'Kumar', phone: '+919800000035', profilePhotoUrl: '', isActive: true, isLocked: true, failedLoginAttempts: 5, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-03T00:00:00Z', updatedAt: new Date().toISOString() },
  { userId: 'user-035', tenantId: 'tenant-001', email: 'parent.verma@greenwood.edu', role: UserRole.PARENT, firstName: 'Rekha', lastName: 'Verma', phone: '+919800000036', profilePhotoUrl: '', isActive: true, isLocked: false, failedLoginAttempts: 0, lastLoginAt: new Date().toISOString(), createdAt: '2024-02-04T00:00:00Z', updatedAt: new Date().toISOString() },
];

// ==================== Mock Students (20 Students) ====================
export const mockStudents = [
  // Grade 10A
  { studentId: 'student-001', userId: 'user-004', user: mockUsers.student, rollNumber: '1001', admissionNumber: 'ADM-2024-0001', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', parentIds: ['user-005'], dateOfBirth: '2009-03-15', gender: Gender.MALE, bloodGroup: 'B+', address: { street: '25, Shivaji Nagar', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411005' }, academicHistory: [{ academicYearId: 'ay-002', classId: 'class-002', result: 'Passed - 89%' }], documents: [], createdAt: '2024-02-01T00:00:00Z' },
  { studentId: 'student-002', userId: 'user-011', rollNumber: '1002', admissionNumber: 'ADM-2024-0002', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', parentIds: ['user-031'], dateOfBirth: '2009-07-22', gender: Gender.FEMALE, bloodGroup: 'A+', address: { street: '18, Koregaon Park', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411001' }, academicHistory: [{ academicYearId: 'ay-002', classId: 'class-002', result: 'Passed - 92%' }], documents: [], createdAt: '2024-02-02T00:00:00Z' },
  { studentId: 'student-003', userId: 'user-012', rollNumber: '1003', admissionNumber: 'ADM-2024-0003', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', parentIds: ['user-032'], dateOfBirth: '2009-01-10', gender: Gender.MALE, bloodGroup: 'O+', address: { street: '7, Camp Area', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411001' }, academicHistory: [{ academicYearId: 'ay-002', classId: 'class-002', result: 'Passed - 78%' }], documents: [], createdAt: '2024-02-02T00:00:00Z' },
  { studentId: 'student-004', userId: 'user-013', rollNumber: '1004', admissionNumber: 'ADM-2024-0004', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', parentIds: ['user-033'], dateOfBirth: '2009-11-05', gender: Gender.FEMALE, bloodGroup: 'AB+', address: { street: '33, Aundh', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411007' }, academicHistory: [{ academicYearId: 'ay-002', classId: 'class-002', result: 'Passed - 95%' }], documents: [], createdAt: '2024-02-03T00:00:00Z' },
  // Grade 10B
  { studentId: 'student-005', userId: 'user-014', rollNumber: '1005', admissionNumber: 'ADM-2024-0005', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-002', sectionName: 'B', parentIds: ['user-034'], dateOfBirth: '2009-04-18', gender: Gender.MALE, bloodGroup: 'B-', address: { street: '45, Kothrud', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411038' }, academicHistory: [{ academicYearId: 'ay-002', classId: 'class-002', result: 'Passed - 82%' }], documents: [], createdAt: '2024-02-03T00:00:00Z' },
  { studentId: 'student-006', userId: 'user-015', rollNumber: '1006', admissionNumber: 'ADM-2024-0006', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-002', sectionName: 'B', parentIds: ['user-035'], dateOfBirth: '2009-09-30', gender: Gender.FEMALE, bloodGroup: 'A-', address: { street: '12, Baner', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411045' }, academicHistory: [{ academicYearId: 'ay-002', classId: 'class-002', result: 'Passed - 88%' }], documents: [], createdAt: '2024-02-04T00:00:00Z' },
  { studentId: 'student-007', userId: 'user-016', rollNumber: '1007', admissionNumber: 'ADM-2024-0007', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-002', sectionName: 'B', parentIds: [], dateOfBirth: '2009-06-12', gender: Gender.MALE, bloodGroup: 'O-', address: { street: '9, Hadapsar', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411028' }, academicHistory: [], documents: [], createdAt: '2024-02-05T00:00:00Z' },
  // Grade 9A
  { studentId: 'student-008', userId: 'user-017', rollNumber: '0901', admissionNumber: 'ADM-2024-0008', classId: 'class-002', className: 'Grade 9', sectionId: 'sec-003', sectionName: 'A', parentIds: [], dateOfBirth: '2010-02-14', gender: Gender.FEMALE, bloodGroup: 'B+', address: { street: '55, Viman Nagar', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411014' }, academicHistory: [], documents: [], createdAt: '2024-02-06T00:00:00Z' },
  { studentId: 'student-009', userId: 'user-018', rollNumber: '0902', admissionNumber: 'ADM-2024-0009', classId: 'class-002', className: 'Grade 9', sectionId: 'sec-003', sectionName: 'A', parentIds: [], dateOfBirth: '2010-08-03', gender: Gender.MALE, bloodGroup: 'A+', address: { street: '22, Wakad', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411057' }, academicHistory: [], documents: [], createdAt: '2024-02-07T00:00:00Z' },
  { studentId: 'student-010', userId: 'user-019', rollNumber: '0903', admissionNumber: 'ADM-2024-0010', classId: 'class-002', className: 'Grade 9', sectionId: 'sec-003', sectionName: 'A', parentIds: [], dateOfBirth: '2010-12-25', gender: Gender.FEMALE, bloodGroup: 'O+', address: { street: '8, Hinjewadi', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411057' }, academicHistory: [], documents: [], createdAt: '2024-02-08T00:00:00Z' },
  // Grade 9B
  { studentId: 'student-011', userId: 'user-020', rollNumber: '0904', admissionNumber: 'ADM-2024-0011', classId: 'class-002', className: 'Grade 9', sectionId: 'sec-004', sectionName: 'B', parentIds: [], dateOfBirth: '2010-05-17', gender: Gender.MALE, bloodGroup: 'AB-', address: { street: '31, Pimpri', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411018' }, academicHistory: [], documents: [], createdAt: '2024-02-09T00:00:00Z' },
  { studentId: 'student-012', userId: 'user-021', rollNumber: '0905', admissionNumber: 'ADM-2024-0012', classId: 'class-002', className: 'Grade 9', sectionId: 'sec-004', sectionName: 'B', parentIds: [], dateOfBirth: '2010-10-08', gender: Gender.FEMALE, bloodGroup: 'B+', address: { street: '14, Chinchwad', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411019' }, academicHistory: [], documents: [], createdAt: '2024-02-10T00:00:00Z' },
  // Grade 8A
  { studentId: 'student-013', userId: 'user-022', rollNumber: '0801', admissionNumber: 'ADM-2024-0013', classId: 'class-003', className: 'Grade 8', sectionId: 'sec-005', sectionName: 'A', parentIds: [], dateOfBirth: '2011-01-20', gender: Gender.MALE, bloodGroup: 'A+', address: { street: '40, Kondhwa', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411048' }, academicHistory: [], documents: [], createdAt: '2024-02-10T00:00:00Z' },
  { studentId: 'student-014', userId: 'user-023', rollNumber: '0802', admissionNumber: 'ADM-2024-0014', classId: 'class-003', className: 'Grade 8', sectionId: 'sec-005', sectionName: 'A', parentIds: [], dateOfBirth: '2011-06-15', gender: Gender.FEMALE, bloodGroup: 'O+', address: { street: '17, Undri', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411060' }, academicHistory: [], documents: [], createdAt: '2024-02-11T00:00:00Z' },
  // Grade 8B
  { studentId: 'student-015', userId: 'user-024', rollNumber: '0803', admissionNumber: 'ADM-2024-0015', classId: 'class-003', className: 'Grade 8', sectionId: 'sec-006', sectionName: 'B', parentIds: [], dateOfBirth: '2011-03-28', gender: Gender.MALE, bloodGroup: 'B-', address: { street: '5, Katraj', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411046' }, academicHistory: [], documents: [], createdAt: '2024-02-12T00:00:00Z' },
  // Grade 7A
  { studentId: 'student-016', userId: 'user-025', rollNumber: '0701', admissionNumber: 'ADM-2024-0016', classId: 'class-004', className: 'Grade 7', sectionId: 'sec-007', sectionName: 'A', parentIds: [], dateOfBirth: '2012-04-10', gender: Gender.FEMALE, bloodGroup: 'A-', address: { street: '28, Sinhagad Road', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411030' }, academicHistory: [], documents: [], createdAt: '2024-02-13T00:00:00Z' },
  { studentId: 'student-017', userId: 'user-026', rollNumber: '0702', admissionNumber: 'ADM-2024-0017', classId: 'class-004', className: 'Grade 7', sectionId: 'sec-007', sectionName: 'A', parentIds: [], dateOfBirth: '2012-09-01', gender: Gender.MALE, bloodGroup: 'O+', address: { street: '63, Warje', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411058' }, academicHistory: [], documents: [], createdAt: '2024-02-14T00:00:00Z' },
  // Grade 6A
  { studentId: 'student-018', userId: 'user-027', rollNumber: '0601', admissionNumber: 'ADM-2024-0018', classId: 'class-005', className: 'Grade 6', sectionId: 'sec-009', sectionName: 'A', parentIds: [], dateOfBirth: '2013-07-19', gender: Gender.FEMALE, bloodGroup: 'AB+', address: { street: '50, Deccan Gymkhana', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411004' }, academicHistory: [], documents: [], createdAt: '2024-02-15T00:00:00Z' },
  // Grade 5A
  { studentId: 'student-019', userId: 'user-028', rollNumber: '0501', admissionNumber: 'ADM-2024-0019', classId: 'class-006', className: 'Grade 5', sectionId: 'sec-011', sectionName: 'A', parentIds: [], dateOfBirth: '2014-02-28', gender: Gender.MALE, bloodGroup: 'B+', address: { street: '71, Model Colony', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411016' }, academicHistory: [], documents: [], createdAt: '2024-02-16T00:00:00Z' },
  { studentId: 'student-020', userId: 'user-029', rollNumber: '0502', admissionNumber: 'ADM-2024-0020', classId: 'class-006', className: 'Grade 5', sectionId: 'sec-011', sectionName: 'A', parentIds: [], dateOfBirth: '2014-11-11', gender: Gender.FEMALE, bloodGroup: 'A+', address: { street: '3, Pashan', city: 'Pune', state: 'Maharashtra', country: 'India', zip: '411021' }, academicHistory: [], documents: [], createdAt: '2024-02-17T00:00:00Z' },
];

// ==================== Mock Teachers (8 Teachers) ====================
export const mockTeachers = [
  { teacherId: 'teacher-001', userId: 'user-003', user: mockUsers.teacher, employeeId: 'EMP-001', qualification: 'M.Sc. Mathematics, B.Ed.', specialization: 'Algebra & Calculus', subjectIds: ['sub-001'], subjects: [mockSubjects[0]], classIds: ['class-001', 'class-002'], sectionIds: ['sec-001', 'sec-002', 'sec-003', 'sec-004'], isClassTeacher: true, classTeacherOf: { classId: 'class-001', sectionId: 'sec-001', className: 'Grade 10', sectionName: 'A' }, joiningDate: '2018-06-15', documents: [] },
  { teacherId: 'teacher-002', userId: 'user-006', user: mockUsersList[5], employeeId: 'EMP-002', qualification: 'M.Sc. Physics, B.Ed.', specialization: 'Optics & Thermodynamics', subjectIds: ['sub-002', 'sub-007'], subjects: [mockSubjects[1], mockSubjects[6]], classIds: ['class-001', 'class-002'], sectionIds: ['sec-001', 'sec-002', 'sec-003', 'sec-004'], isClassTeacher: true, classTeacherOf: { classId: 'class-001', sectionId: 'sec-002', className: 'Grade 10', sectionName: 'B' }, joiningDate: '2019-07-01', documents: [] },
  { teacherId: 'teacher-003', userId: 'user-007', user: mockUsersList[6], employeeId: 'EMP-003', qualification: 'M.A. English Literature, B.Ed.', specialization: 'Grammar & Composition', subjectIds: ['sub-003'], subjects: [mockSubjects[2]], classIds: ['class-001', 'class-002', 'class-003'], sectionIds: ['sec-001', 'sec-002', 'sec-003', 'sec-004', 'sec-005', 'sec-006'], isClassTeacher: true, classTeacherOf: { classId: 'class-002', sectionId: 'sec-003', className: 'Grade 9', sectionName: 'A' }, joiningDate: '2017-04-10', documents: [] },
  { teacherId: 'teacher-004', userId: 'user-008', user: mockUsersList[7], employeeId: 'EMP-004', qualification: 'M.A. Hindi, B.Ed.', specialization: 'Hindi Sahitya', subjectIds: ['sub-004'], subjects: [mockSubjects[3]], classIds: ['class-001', 'class-002', 'class-003', 'class-004'], sectionIds: ['sec-001', 'sec-002', 'sec-003', 'sec-004', 'sec-005', 'sec-006', 'sec-007', 'sec-008'], isClassTeacher: true, classTeacherOf: { classId: 'class-002', sectionId: 'sec-004', className: 'Grade 9', sectionName: 'B' }, joiningDate: '2020-01-05', documents: [] },
  { teacherId: 'teacher-005', userId: 'user-009', user: mockUsersList[8], employeeId: 'EMP-005', qualification: 'M.A. History, M.Ed.', specialization: 'Indian History & Civics', subjectIds: ['sub-005'], subjects: [mockSubjects[4]], classIds: ['class-001', 'class-002', 'class-003', 'class-004', 'class-005'], sectionIds: ['sec-001', 'sec-002', 'sec-003', 'sec-004', 'sec-005', 'sec-006', 'sec-007', 'sec-008', 'sec-009', 'sec-010'], isClassTeacher: true, classTeacherOf: { classId: 'class-003', sectionId: 'sec-005', className: 'Grade 8', sectionName: 'A' }, joiningDate: '2016-08-20', documents: [] },
  { teacherId: 'teacher-006', userId: 'user-010', user: mockUsersList[9], employeeId: 'EMP-006', qualification: 'M.Tech. Computer Science', specialization: 'Programming & Data Structures', subjectIds: ['sub-006'], subjects: [mockSubjects[5]], classIds: ['class-001', 'class-002', 'class-003'], sectionIds: ['sec-001', 'sec-002', 'sec-003', 'sec-004', 'sec-005', 'sec-006'], isClassTeacher: true, classTeacherOf: { classId: 'class-004', sectionId: 'sec-007', className: 'Grade 7', sectionName: 'A' }, joiningDate: '2021-11-15', documents: [] },
  { teacherId: 'teacher-007', userId: 'user-036' as string, employeeId: 'EMP-007', qualification: 'M.Sc. Chemistry, B.Ed.', specialization: 'Organic Chemistry', subjectIds: ['sub-002'], subjects: [mockSubjects[1]], classIds: ['class-003', 'class-004', 'class-005', 'class-006'], sectionIds: ['sec-005', 'sec-006', 'sec-007', 'sec-008', 'sec-009', 'sec-010', 'sec-011', 'sec-012'], isClassTeacher: false, classTeacherOf: null, joiningDate: '2022-03-01', documents: [] },
  { teacherId: 'teacher-008', userId: 'user-037' as string, employeeId: 'EMP-008', qualification: 'B.F.A., M.A. Fine Arts', specialization: 'Painting & Sketching', subjectIds: ['sub-008'], subjects: [mockSubjects[7]], classIds: ['class-003', 'class-004', 'class-005', 'class-006'], sectionIds: ['sec-005', 'sec-006', 'sec-007', 'sec-008', 'sec-009', 'sec-010', 'sec-011', 'sec-012'], isClassTeacher: false, classTeacherOf: null, joiningDate: '2023-06-01', documents: [] },
];

// ==================== Mock Events (10 Events) ====================
export const mockEvents = [
  { eventId: 'event-001', title: 'Parent-Teacher Meeting', type: EventType.ACADEMIC, startDate: '2024-07-20', endDate: '2024-07-20', isHoliday: false, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Quarterly parent-teacher meeting to discuss student progress and academic performance.', createdBy: 'user-001', createdAt: '2024-07-01T00:00:00Z' },
  { eventId: 'event-002', title: 'Annual Sports Day', type: EventType.SPORTS, startDate: '2024-12-14', endDate: '2024-12-15', isHoliday: false, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Two-day annual sports day with athletics, kho-kho, kabaddi, cricket, and relay races.', createdBy: 'user-001', createdAt: '2024-11-15T00:00:00Z' },
  { eventId: 'event-003', title: 'Diwali Vacation', type: EventType.HOLIDAY, startDate: '2024-10-31', endDate: '2024-11-04', isHoliday: true, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'School closed for Diwali festival.', createdBy: 'user-001', createdAt: '2024-10-01T00:00:00Z' },
  { eventId: 'event-004', title: 'Science Exhibition', type: EventType.ACADEMIC, startDate: '2024-09-15', endDate: '2024-09-15', isHoliday: false, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Annual science exhibition showcasing student projects on renewable energy and robotics.', createdBy: 'user-002', createdAt: '2024-08-20T00:00:00Z' },
  { eventId: 'event-005', title: 'Ganesh Chaturthi', type: EventType.HOLIDAY, startDate: '2024-09-07', endDate: '2024-09-07', isHoliday: true, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'School closed for Ganesh Chaturthi.', createdBy: 'user-001', createdAt: '2024-08-15T00:00:00Z' },
  { eventId: 'event-006', title: 'Inter-House Cricket Tournament', type: EventType.SPORTS, startDate: '2024-08-10', endDate: '2024-08-12', isHoliday: false, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Inter-house cricket tournament. Matches from 9 AM to 4 PM each day.', createdBy: 'user-002', createdAt: '2024-07-25T00:00:00Z' },
  { eventId: 'event-007', title: 'Independence Day Celebration', type: EventType.CULTURAL, startDate: '2024-08-15', endDate: '2024-08-15', isHoliday: true, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Flag hoisting ceremony followed by cultural program. All students must attend in school uniform.', createdBy: 'user-001', createdAt: '2024-08-01T00:00:00Z' },
  { eventId: 'event-008', title: 'Annual Cultural Fest - Tarang', type: EventType.CULTURAL, startDate: '2025-01-25', endDate: '2025-01-26', isHoliday: false, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Annual cultural festival featuring music, dance, drama, debate, and art competitions.', createdBy: 'user-001', createdAt: '2025-01-05T00:00:00Z' },
  { eventId: 'event-009', title: 'Mid-Term Examinations', type: EventType.ACADEMIC, startDate: '2024-09-20', endDate: '2024-10-05', isHoliday: false, isRecurring: false, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Mid-term examinations for all classes. Regular classes suspended during exam period.', createdBy: 'user-001', createdAt: '2024-09-01T00:00:00Z' },
  { eventId: 'event-010', title: 'Republic Day', type: EventType.HOLIDAY, startDate: '2025-01-26', endDate: '2025-01-26', isHoliday: true, isRecurring: true, recurrencePattern: 'YEARLY' as const, visibleTo: ['ALL'] as ('ALL' | UserRole)[], description: 'Republic Day - national holiday.', createdBy: 'user-001', createdAt: '2024-01-01T00:00:00Z' },
];

// ==================== Mock Exams (8 Exams) ====================
export const mockExams = [
  { examId: 'exam-001', name: 'Mid-Term Mathematics', academicYearId: 'ay-001', classIds: ['class-001'], subjectId: 'sub-001', subjectName: 'Mathematics', date: '2024-09-20', startTime: '09:00', endTime: '12:00', maxMarks: 100, passingMarks: 33, status: 'COMPLETED' as const, createdBy: 'user-003', createdAt: '2024-09-01T00:00:00Z' },
  { examId: 'exam-002', name: 'Mid-Term Science', academicYearId: 'ay-001', classIds: ['class-001', 'class-002'], subjectId: 'sub-002', subjectName: 'Science', date: '2024-09-22', startTime: '09:00', endTime: '12:00', maxMarks: 100, passingMarks: 33, status: 'COMPLETED' as const, createdBy: 'user-006', createdAt: '2024-09-01T00:00:00Z' },
  { examId: 'exam-003', name: 'Mid-Term English', academicYearId: 'ay-001', classIds: ['class-001', 'class-002'], subjectId: 'sub-003', subjectName: 'English', date: '2024-09-24', startTime: '09:00', endTime: '12:00', maxMarks: 100, passingMarks: 33, status: 'COMPLETED' as const, createdBy: 'user-007', createdAt: '2024-09-01T00:00:00Z' },
  { examId: 'exam-004', name: 'Hindi Unit Test 2', academicYearId: 'ay-001', classIds: ['class-001', 'class-002', 'class-003'], subjectId: 'sub-004', subjectName: 'Hindi', date: '2024-10-10', startTime: '10:00', endTime: '11:30', maxMarks: 50, passingMarks: 17, status: 'COMPLETED' as const, createdBy: 'user-008', createdAt: '2024-09-25T00:00:00Z' },
  { examId: 'exam-005', name: 'Social Studies Quarterly', academicYearId: 'ay-001', classIds: ['class-001', 'class-002', 'class-003'], subjectId: 'sub-005', subjectName: 'Social Studies', date: '2024-10-15', startTime: '09:00', endTime: '11:00', maxMarks: 50, passingMarks: 17, status: 'COMPLETED' as const, createdBy: 'user-009', createdAt: '2024-10-01T00:00:00Z' },
  { examId: 'exam-006', name: 'Final Term Mathematics', academicYearId: 'ay-001', classIds: ['class-001', 'class-002'], subjectId: 'sub-001', subjectName: 'Mathematics', date: '2025-02-15', startTime: '09:00', endTime: '12:00', maxMarks: 100, passingMarks: 33, status: 'SCHEDULED' as const, createdBy: 'user-003', createdAt: '2025-01-15T00:00:00Z' },
  { examId: 'exam-007', name: 'Computer Science Practical', academicYearId: 'ay-001', classIds: ['class-001'], subjectId: 'sub-006', subjectName: 'Computer Science', date: '2025-02-20', startTime: '14:00', endTime: '16:00', maxMarks: 50, passingMarks: 17, status: 'SCHEDULED' as const, createdBy: 'user-010', createdAt: '2025-01-20T00:00:00Z' },
  { examId: 'exam-008', name: 'Physics Lab Practical', academicYearId: 'ay-001', classIds: ['class-001', 'class-002'], subjectId: 'sub-007', subjectName: 'Physics Lab', date: '2025-02-22', startTime: '10:00', endTime: '12:00', maxMarks: 30, passingMarks: 10, status: 'SCHEDULED' as const, createdBy: 'user-006', createdAt: '2025-01-22T00:00:00Z' },
];

// ==================== Mock Exam Marks ====================
export const mockExamMarks = [
  { markId: 'mark-001', examId: 'exam-001', studentId: 'student-001', marksObtained: 87, grade: 'A', remarks: 'Excellent performance', enteredBy: 'user-003', enteredAt: '2024-09-21T10:00:00Z', isLocked: true },
  { markId: 'mark-002', examId: 'exam-001', studentId: 'student-002', marksObtained: 92, grade: 'A+', remarks: 'Outstanding', enteredBy: 'user-003', enteredAt: '2024-09-21T10:00:00Z', isLocked: true },
  { markId: 'mark-003', examId: 'exam-001', studentId: 'student-003', marksObtained: 65, grade: 'B', remarks: 'Good effort, can improve in geometry', enteredBy: 'user-003', enteredAt: '2024-09-21T10:00:00Z', isLocked: true },
  { markId: 'mark-004', examId: 'exam-001', studentId: 'student-004', marksObtained: 96, grade: 'A+', remarks: 'Exceptional work', enteredBy: 'user-003', enteredAt: '2024-09-21T10:00:00Z', isLocked: true },
  { markId: 'mark-005', examId: 'exam-001', studentId: 'student-005', marksObtained: 42, grade: 'C', remarks: 'Needs to focus on problem solving', enteredBy: 'user-003', enteredAt: '2024-09-21T10:00:00Z', isLocked: true },
  { markId: 'mark-006', examId: 'exam-002', studentId: 'student-001', marksObtained: 78, grade: 'B+', remarks: '', enteredBy: 'user-006', enteredAt: '2024-09-23T10:00:00Z', isLocked: true },
  { markId: 'mark-007', examId: 'exam-002', studentId: 'student-002', marksObtained: 85, grade: 'A', remarks: 'Very good understanding of concepts', enteredBy: 'user-006', enteredAt: '2024-09-23T10:00:00Z', isLocked: true },
  { markId: 'mark-008', examId: 'exam-002', studentId: 'student-008', marksObtained: 71, grade: 'B+', remarks: '', enteredBy: 'user-006', enteredAt: '2024-09-23T10:00:00Z', isLocked: false },
  { markId: 'mark-009', examId: 'exam-003', studentId: 'student-001', marksObtained: 82, grade: 'A', remarks: 'Good essay writing skills', enteredBy: 'user-007', enteredAt: '2024-09-25T10:00:00Z', isLocked: true },
  { markId: 'mark-010', examId: 'exam-003', studentId: 'student-004', marksObtained: 90, grade: 'A+', remarks: 'Excellent comprehension', enteredBy: 'user-007', enteredAt: '2024-09-25T10:00:00Z', isLocked: true },
];

// ==================== Mock Attendance ====================
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

export const mockAttendance = [
  // Today - Grade 10A
  { attendanceId: 'att-001', studentId: 'student-001', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-002', studentId: 'student-002', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-003', studentId: 'student-003', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: today, status: AttendanceStatus.ABSENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: 'Sick leave - fever', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-004', studentId: 'student-004', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Today - Grade 10B
  { attendanceId: 'att-005', studentId: 'student-005', classId: 'class-001', sectionId: 'sec-002', academicYearId: 'ay-001', date: today, status: AttendanceStatus.LATE, markedBy: 'user-006', markedByName: 'Priya Nair', remarks: 'Arrived 20 minutes late', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-006', studentId: 'student-006', classId: 'class-001', sectionId: 'sec-002', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-006', markedByName: 'Priya Nair', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-007', studentId: 'student-007', classId: 'class-001', sectionId: 'sec-002', academicYearId: 'ay-001', date: today, status: AttendanceStatus.HALF_DAY, markedBy: 'user-006', markedByName: 'Priya Nair', remarks: 'Left after lunch - dental appointment', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Today - Grade 9A
  { attendanceId: 'att-008', studentId: 'student-008', classId: 'class-002', sectionId: 'sec-003', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-007', markedByName: 'Anjali Gupta', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-009', studentId: 'student-009', classId: 'class-002', sectionId: 'sec-003', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-007', markedByName: 'Anjali Gupta', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-010', studentId: 'student-010', classId: 'class-002', sectionId: 'sec-003', academicYearId: 'ay-001', date: today, status: AttendanceStatus.ABSENT, markedBy: 'user-007', markedByName: 'Anjali Gupta', remarks: 'Family function', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Today - Grade 9B
  { attendanceId: 'att-011', studentId: 'student-011', classId: 'class-002', sectionId: 'sec-004', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-008', markedByName: 'Deepak Joshi', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-012', studentId: 'student-012', classId: 'class-002', sectionId: 'sec-004', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-008', markedByName: 'Deepak Joshi', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Yesterday - Grade 10A
  { attendanceId: 'att-013', studentId: 'student-001', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-014', studentId: 'student-002', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-015', studentId: 'student-003', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-016', studentId: 'student-004', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.LATE, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: 'Bus was late', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  // Yesterday - Grade 10B
  { attendanceId: 'att-017', studentId: 'student-005', classId: 'class-001', sectionId: 'sec-002', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-006', markedByName: 'Priya Nair', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-018', studentId: 'student-006', classId: 'class-001', sectionId: 'sec-002', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.ABSENT, markedBy: 'user-006', markedByName: 'Priya Nair', remarks: 'Unexcused', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-019', studentId: 'student-007', classId: 'class-001', sectionId: 'sec-002', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-006', markedByName: 'Priya Nair', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  // Yesterday - Grade 9A
  { attendanceId: 'att-020', studentId: 'student-008', classId: 'class-002', sectionId: 'sec-003', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-007', markedByName: 'Anjali Gupta', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-021', studentId: 'student-009', classId: 'class-002', sectionId: 'sec-003', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.ABSENT, markedBy: 'user-007', markedByName: 'Anjali Gupta', remarks: 'Medical leave', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { attendanceId: 'att-022', studentId: 'student-010', classId: 'class-002', sectionId: 'sec-003', academicYearId: 'ay-001', date: yesterday, status: AttendanceStatus.PRESENT, markedBy: 'user-007', markedByName: 'Anjali Gupta', remarks: '', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  // Two days ago - Grade 10A
  { attendanceId: 'att-023', studentId: 'student-001', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: twoDaysAgo, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { attendanceId: 'att-024', studentId: 'student-002', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: twoDaysAgo, status: AttendanceStatus.LATE, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: 'Arrived at 8:25 AM', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { attendanceId: 'att-025', studentId: 'student-003', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: twoDaysAgo, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { attendanceId: 'att-026', studentId: 'student-004', classId: 'class-001', sectionId: 'sec-001', academicYearId: 'ay-001', date: twoDaysAgo, status: AttendanceStatus.PRESENT, markedBy: 'user-003', markedByName: 'Ramesh Iyer', remarks: '', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  // Two days ago - Grade 8A
  { attendanceId: 'att-027', studentId: 'student-013', classId: 'class-003', sectionId: 'sec-005', academicYearId: 'ay-001', date: twoDaysAgo, status: AttendanceStatus.PRESENT, markedBy: 'user-009', markedByName: 'Kavita Reddy', remarks: '', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { attendanceId: 'att-028', studentId: 'student-014', classId: 'class-003', sectionId: 'sec-005', academicYearId: 'ay-001', date: twoDaysAgo, status: AttendanceStatus.HALF_DAY, markedBy: 'user-009', markedByName: 'Kavita Reddy', remarks: 'Left early due to headache', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  // Grade 7A
  { attendanceId: 'att-029', studentId: 'student-016', classId: 'class-004', sectionId: 'sec-007', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-010', markedByName: 'Suresh Pillai', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { attendanceId: 'att-030', studentId: 'student-017', classId: 'class-004', sectionId: 'sec-007', academicYearId: 'ay-001', date: today, status: AttendanceStatus.PRESENT, markedBy: 'user-010', markedByName: 'Suresh Pillai', remarks: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// ==================== Mock Attendance Records (Alias for backward compatibility) ====================
export const mockAttendanceRecords = mockAttendance;

// ==================== Mock Notifications (8 Notifications) ====================
export const mockNotifications = [
  { notificationId: 'notif-001', title: 'Mid-Term Exam Schedule Released', body: 'The mid-term examination schedule for September-October has been released. Please check the exams section for detailed timetable.', type: NotificationType.EXAM, channel: NotificationChannel.BOTH, recipientType: 'ALL' as const, readBy: [] as string[], sentAt: new Date().toISOString(), createdBy: 'user-001' },
  { notificationId: 'notif-002', title: 'Fee Payment Reminder - October', body: 'This is a reminder to pay the pending fees for October before the due date of 15th October. Late fee of Rs 500 will be applicable after the due date.', type: NotificationType.FEE, channel: NotificationChannel.BOTH, recipientType: 'ROLE' as const, recipientRole: UserRole.PARENT, readBy: [] as string[], sentAt: new Date().toISOString(), createdBy: 'user-001' },
  { notificationId: 'notif-003', title: 'Annual Sports Day Registration Open', body: 'Registration for the Annual Sports Day events is now open. Students can register for up to 3 events. Last date: 5th December.', type: NotificationType.ANNOUNCEMENT, channel: NotificationChannel.IN_APP, recipientType: 'ALL' as const, readBy: ['user-004', 'user-011'] as string[], sentAt: new Date(Date.now() - 86400000).toISOString(), createdBy: 'user-002' },
  { notificationId: 'notif-004', title: 'Low Attendance Warning', body: 'Your attendance has fallen below 75%. As per school policy, minimum 75% attendance is mandatory. Please maintain regular attendance.', type: NotificationType.ATTENDANCE, channel: NotificationChannel.BOTH, recipientType: 'INDIVIDUAL' as const, recipientIds: ['user-014', 'user-016'], readBy: [] as string[], sentAt: new Date(Date.now() - 172800000).toISOString(), createdBy: 'user-002' },
  { notificationId: 'notif-005', title: 'New Study Material - Chapter 8 Mathematics', body: 'New study material for Mathematics Chapter 8 (Quadratic Equations) has been uploaded. Practice problems included.', type: NotificationType.GENERAL, channel: NotificationChannel.IN_APP, recipientType: 'CLASS' as const, recipientClassId: 'class-001', readBy: ['user-004', 'user-011', 'user-013'] as string[], sentAt: new Date(Date.now() - 259200000).toISOString(), createdBy: 'user-003' },
  { notificationId: 'notif-006', title: 'Diwali Vacation Announcement', body: 'School will remain closed from 31st October to 4th November on account of Diwali vacation. Classes will resume on 5th November.', type: NotificationType.ANNOUNCEMENT, channel: NotificationChannel.BOTH, recipientType: 'ALL' as const, readBy: ['user-004', 'user-005', 'user-011'] as string[], sentAt: new Date(Date.now() - 345600000).toISOString(), createdBy: 'user-001' },
  { notificationId: 'notif-007', title: 'PTM Scheduled for 20th July', body: 'Parent-Teacher Meeting is scheduled for 20th July from 9 AM to 1 PM. Parents are requested to attend without fail.', type: NotificationType.ANNOUNCEMENT, channel: NotificationChannel.BOTH, recipientType: 'ROLE' as const, recipientRole: UserRole.PARENT, readBy: ['user-005', 'user-031'] as string[], sentAt: new Date(Date.now() - 432000000).toISOString(), createdBy: 'user-002' },
  { notificationId: 'notif-008', title: 'System Maintenance - Saturday Night', body: 'The school portal will undergo scheduled maintenance on Saturday from 11 PM to 2 AM. Please save your work before the maintenance window.', type: NotificationType.ALERT as unknown as NotificationType, channel: NotificationChannel.IN_APP, recipientType: 'ALL' as const, readBy: [] as string[], sentAt: new Date(Date.now() - 518400000).toISOString(), createdBy: 'user-001' },
];

// ==================== Mock Fee Structures (5 Fee Structures) ====================
export const mockFeeStructures = [
  { feeStructureId: 'fee-str-001', academicYearId: 'ay-001', classId: 'class-001', className: 'Grade 10', feeType: 'Tuition Fee', amount: 18000, dueDate: '2024-10-15', description: 'Monthly tuition fee for October', createdAt: '2024-09-01T00:00:00Z' },
  { feeStructureId: 'fee-str-002', academicYearId: 'ay-001', classId: 'class-001', className: 'Grade 10', feeType: 'Lab Fee', amount: 5000, dueDate: '2024-07-15', description: 'Annual lab fee for science and computer labs', createdAt: '2024-06-01T00:00:00Z' },
  { feeStructureId: 'fee-str-003', academicYearId: 'ay-001', classId: 'class-001', className: 'Grade 10', feeType: 'Library Fee', amount: 2000, dueDate: '2024-07-15', description: 'Annual library and reading room fee', createdAt: '2024-06-01T00:00:00Z' },
  { feeStructureId: 'fee-str-004', academicYearId: 'ay-001', classId: 'class-001', className: 'Grade 10', feeType: 'Sports Fee', amount: 3000, dueDate: '2024-08-01', description: 'Annual sports and extracurricular activities fee', createdAt: '2024-06-01T00:00:00Z' },
  { feeStructureId: 'fee-str-005', academicYearId: 'ay-001', classId: 'class-001', className: 'Grade 10', feeType: 'Transport Fee', amount: 4500, dueDate: '2024-10-15', description: 'Monthly school bus transport fee for October', createdAt: '2024-09-01T00:00:00Z' },
];

// ==================== Mock Fee Payments (10 Payments) ====================
export const mockFeePayments = [
  { paymentId: 'pay-001', studentId: 'student-001', feeStructureId: 'fee-str-001', amountPaid: 18000, paymentDate: '2024-10-10', paymentMode: 'ONLINE' as const, receiptNumber: 'REC-2024-0001', remarks: '', createdBy: 'user-001', createdAt: '2024-10-10T10:00:00Z' },
  { paymentId: 'pay-002', studentId: 'student-001', feeStructureId: 'fee-str-002', amountPaid: 5000, paymentDate: '2024-07-12', paymentMode: 'ONLINE' as const, receiptNumber: 'REC-2024-0002', remarks: '', createdBy: 'user-001', createdAt: '2024-07-12T10:05:00Z' },
  { paymentId: 'pay-003', studentId: 'student-002', feeStructureId: 'fee-str-001', amountPaid: 18000, paymentDate: '2024-10-12', paymentMode: 'BANK_TRANSFER' as const, receiptNumber: 'REC-2024-0003', remarks: 'NEFT transfer', createdBy: 'user-001', createdAt: '2024-10-12T09:00:00Z' },
  { paymentId: 'pay-004', studentId: 'student-003', feeStructureId: 'fee-str-001', amountPaid: 18000, paymentDate: '2024-10-08', paymentMode: 'CASH' as const, receiptNumber: 'REC-2024-0004', remarks: 'Paid by father', createdBy: 'user-001', createdAt: '2024-10-08T11:30:00Z' },
  { paymentId: 'pay-005', studentId: 'student-005', feeStructureId: 'fee-str-001', amountPaid: 10000, paymentDate: '2024-10-14', paymentMode: 'CHEQUE' as const, receiptNumber: 'REC-2024-0005', remarks: 'Partial payment, balance Rs 8000 pending', createdBy: 'user-001', createdAt: '2024-10-14T14:00:00Z' },
  { paymentId: 'pay-006', studentId: 'student-004', feeStructureId: 'fee-str-001', amountPaid: 18000, paymentDate: '2024-10-05', paymentMode: 'ONLINE' as const, receiptNumber: 'REC-2024-0006', remarks: 'UPI payment', createdBy: 'user-001', createdAt: '2024-10-05T08:30:00Z' },
  { paymentId: 'pay-007', studentId: 'student-004', feeStructureId: 'fee-str-002', amountPaid: 5000, paymentDate: '2024-07-10', paymentMode: 'ONLINE' as const, receiptNumber: 'REC-2024-0007', remarks: '', createdBy: 'user-001', createdAt: '2024-07-10T09:15:00Z' },
  { paymentId: 'pay-008', studentId: 'student-008', feeStructureId: 'fee-str-001', amountPaid: 18000, paymentDate: '2024-10-15', paymentMode: 'BANK_TRANSFER' as const, receiptNumber: 'REC-2024-0008', remarks: '', createdBy: 'user-001', createdAt: '2024-10-15T11:00:00Z' },
  { paymentId: 'pay-009', studentId: 'student-001', feeStructureId: 'fee-str-004', amountPaid: 3000, paymentDate: '2024-07-28', paymentMode: 'CASH' as const, receiptNumber: 'REC-2024-0009', remarks: '', createdBy: 'user-001', createdAt: '2024-07-28T10:00:00Z' },
  { paymentId: 'pay-010', studentId: 'student-001', feeStructureId: 'fee-str-005', amountPaid: 4500, paymentDate: '2024-10-10', paymentMode: 'ONLINE' as const, receiptNumber: 'REC-2024-0010', remarks: 'Monthly transport fee', createdBy: 'user-001', createdAt: '2024-10-10T10:10:00Z' },
];

// ==================== Mock MCQ Questions (10 Mathematics Questions) ====================
export const mockMcqQuestions = [
  { questionId: 'mcq-q-001', subjectId: 'sub-001', questionText: 'What is the value of x if 2x + 5 = 15?', options: ['3', '5', '7', '10'], correctOptionIndex: 1, difficulty: 'EASY' as const, tags: ['algebra', 'linear-equations'], createdBy: 'user-003', createdAt: '2024-08-15T10:00:00Z' },
  { questionId: 'mcq-q-002', subjectId: 'sub-001', questionText: 'What is the area of a circle with radius 7 cm? (Use pi = 22/7)', options: ['154 sq cm', '44 sq cm', '308 sq cm', '22 sq cm'], correctOptionIndex: 0, difficulty: 'EASY' as const, tags: ['geometry', 'circles', 'mensuration'], createdBy: 'user-003', createdAt: '2024-08-15T10:10:00Z' },
  { questionId: 'mcq-q-003', subjectId: 'sub-001', questionText: 'If the sum of interior angles of a polygon is 720 degrees, how many sides does it have?', options: ['4', '5', '6', '8'], correctOptionIndex: 2, difficulty: 'MEDIUM' as const, tags: ['geometry', 'polygons'], createdBy: 'user-003', createdAt: '2024-08-15T10:20:00Z' },
  { questionId: 'mcq-q-004', subjectId: 'sub-001', questionText: 'The roots of the equation x^2 - 5x + 6 = 0 are:', options: ['2 and 3', '1 and 6', '-2 and -3', '3 and -2'], correctOptionIndex: 0, difficulty: 'MEDIUM' as const, tags: ['algebra', 'quadratic-equations'], createdBy: 'user-003', createdAt: '2024-08-20T09:00:00Z' },
  { questionId: 'mcq-q-005', subjectId: 'sub-001', questionText: 'What is the HCF of 12, 18, and 24?', options: ['2', '4', '6', '12'], correctOptionIndex: 2, difficulty: 'EASY' as const, tags: ['number-theory', 'hcf-lcm'], createdBy: 'user-003', createdAt: '2024-08-20T09:15:00Z' },
  { questionId: 'mcq-q-006', subjectId: 'sub-001', questionText: 'In a right triangle, if the hypotenuse is 13 cm and one side is 5 cm, the other side is:', options: ['8 cm', '10 cm', '12 cm', '11 cm'], correctOptionIndex: 2, difficulty: 'MEDIUM' as const, tags: ['geometry', 'pythagoras'], createdBy: 'user-003', createdAt: '2024-08-25T10:00:00Z' },
  { questionId: 'mcq-q-007', subjectId: 'sub-001', questionText: 'The value of sin 30 degrees is:', options: ['0', '1/2', '1', 'sqrt(3)/2'], correctOptionIndex: 1, difficulty: 'EASY' as const, tags: ['trigonometry', 'ratios'], createdBy: 'user-003', createdAt: '2024-08-25T10:15:00Z' },
  { questionId: 'mcq-q-008', subjectId: 'sub-001', questionText: 'If the probability of an event is 0.3, the probability of its complement is:', options: ['0.3', '0.5', '0.7', '1.3'], correctOptionIndex: 2, difficulty: 'EASY' as const, tags: ['probability', 'statistics'], createdBy: 'user-003', createdAt: '2024-09-01T10:00:00Z' },
  { questionId: 'mcq-q-009', subjectId: 'sub-001', questionText: 'The nth term of the AP 3, 7, 11, 15, ... is:', options: ['4n + 1', '4n - 1', '3n + 1', '3n - 1'], correctOptionIndex: 1, difficulty: 'HARD' as const, tags: ['algebra', 'arithmetic-progression'], createdBy: 'user-003', createdAt: '2024-09-01T10:15:00Z' },
  { questionId: 'mcq-q-010', subjectId: 'sub-001', questionText: 'A cone has a radius of 7 cm and height of 24 cm. Its slant height is:', options: ['25 cm', '31 cm', '17 cm', '20 cm'], correctOptionIndex: 0, difficulty: 'HARD' as const, tags: ['geometry', 'mensuration', '3d-shapes'], createdBy: 'user-003', createdAt: '2024-09-05T10:00:00Z' },
];

// ==================== Mock MCQ Exams (3 Exam Configs) ====================
export const mockMcqExams = [
  {
    examId: 'mcq-exam-001', title: 'Math Chapter 5 - Arithmetic Progression Quiz', subjectId: 'sub-001', subjectName: 'Mathematics',
    classIds: ['class-001'], questionIds: ['mcq-q-001', 'mcq-q-004', 'mcq-q-005', 'mcq-q-009'],
    questions: [mockMcqQuestions[0], mockMcqQuestions[3], mockMcqQuestions[4], mockMcqQuestions[8]],
    duration: 30, startTime: '2024-09-15T09:00:00', endTime: '2024-09-15T18:00:00',
    shuffleQuestions: true, shuffleOptions: false, showResultImmediately: true, allowRetake: false, allowBackNavigation: true,
    status: 'COMPLETED' as const, createdBy: 'user-003', createdAt: '2024-09-10T10:00:00Z',
  },
  {
    examId: 'mcq-exam-002', title: 'Geometry & Mensuration Test', subjectId: 'sub-001', subjectName: 'Mathematics',
    classIds: ['class-001', 'class-002'], questionIds: ['mcq-q-002', 'mcq-q-003', 'mcq-q-006', 'mcq-q-010'],
    questions: [mockMcqQuestions[1], mockMcqQuestions[2], mockMcqQuestions[5], mockMcqQuestions[9]],
    duration: 25, startTime: '2024-10-01T09:00:00', endTime: '2024-10-01T17:00:00',
    shuffleQuestions: true, shuffleOptions: true, showResultImmediately: false, allowRetake: true, allowBackNavigation: true,
    status: 'PUBLISHED' as const, createdBy: 'user-003', createdAt: '2024-09-25T10:00:00Z',
  },
  {
    examId: 'mcq-exam-003', title: 'Math Final Revision Practice', subjectId: 'sub-001', subjectName: 'Mathematics',
    classIds: ['class-001', 'class-002'],
    questionIds: ['mcq-q-001', 'mcq-q-002', 'mcq-q-003', 'mcq-q-004', 'mcq-q-005', 'mcq-q-006', 'mcq-q-007', 'mcq-q-008', 'mcq-q-009', 'mcq-q-010'],
    duration: 60, startTime: '2025-02-01T09:00:00', endTime: '2025-02-10T17:00:00',
    shuffleQuestions: true, shuffleOptions: true, showResultImmediately: true, allowRetake: true, allowBackNavigation: true,
    status: 'DRAFT' as const, createdBy: 'user-003', createdAt: '2025-01-20T10:00:00Z',
  },
];

// ==================== Mock Timetable Entries (6 entries for a typical Monday, Grade 10A) ====================
export const mockTimetable = [
  { entryId: 'tt-001', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', subjectId: 'sub-001', subjectName: 'Mathematics', teacherId: 'teacher-001', teacherName: 'Ramesh Iyer', dayOfWeek: 1, periodNumber: 1, startTime: '08:00', endTime: '08:45', room: 'Room 101' },
  { entryId: 'tt-002', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', subjectId: 'sub-002', subjectName: 'Science', teacherId: 'teacher-002', teacherName: 'Priya Nair', dayOfWeek: 1, periodNumber: 2, startTime: '08:45', endTime: '09:30', room: 'Lab 1' },
  { entryId: 'tt-003', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', subjectId: 'sub-003', subjectName: 'English', teacherId: 'teacher-003', teacherName: 'Anjali Gupta', dayOfWeek: 1, periodNumber: 3, startTime: '09:45', endTime: '10:30', room: 'Room 102' },
  { entryId: 'tt-004', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', subjectId: 'sub-004', subjectName: 'Hindi', teacherId: 'teacher-004', teacherName: 'Deepak Joshi', dayOfWeek: 1, periodNumber: 4, startTime: '10:30', endTime: '11:15', room: 'Room 101' },
  { entryId: 'tt-005', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', subjectId: 'sub-005', subjectName: 'Social Studies', teacherId: 'teacher-005', teacherName: 'Kavita Reddy', dayOfWeek: 1, periodNumber: 5, startTime: '11:30', endTime: '12:15', room: 'Room 103' },
  { entryId: 'tt-006', classId: 'class-001', className: 'Grade 10', sectionId: 'sec-001', sectionName: 'A', subjectId: 'sub-006', subjectName: 'Computer Science', teacherId: 'teacher-006', teacherName: 'Suresh Pillai', dayOfWeek: 1, periodNumber: 6, startTime: '12:15', endTime: '13:00', room: 'CS Lab' },
];

// Alias for backward compatibility
export const mockTimetableEntries = mockTimetable;

// ==================== Mock Mentoring Notes (5 Notes) ====================
export const mockMentoringNotes = [
  { noteId: 'mnote-001', studentId: 'student-001', teacherId: 'teacher-001', teacherName: 'Ramesh Iyer', note: 'Aarav shows exceptional aptitude in mathematics, particularly in algebra and trigonometry. Recommended for the state-level math olympiad.', category: MentoringCategory.ACADEMIC, isFlagged: false, createdAt: '2024-09-10T10:00:00Z' },
  { noteId: 'mnote-002', studentId: 'student-005', teacherId: 'teacher-002', teacherName: 'Priya Nair', note: 'Arjun has been consistently arriving late and appears disengaged in class. Need to discuss with parents regarding his recent behavior change.', category: MentoringCategory.ATTENDANCE, isFlagged: true, createdAt: '2024-09-12T14:00:00Z' },
  { noteId: 'mnote-003', studentId: 'student-004', teacherId: 'teacher-003', teacherName: 'Anjali Gupta', note: 'Ananya actively participates in class discussions and debates. She has shown remarkable improvement in English composition. Great leadership qualities.', category: MentoringCategory.BEHAVIORAL, isFlagged: false, createdAt: '2024-09-15T11:00:00Z' },
  { noteId: 'mnote-004', studentId: 'student-003', teacherId: 'teacher-001', teacherName: 'Ramesh Iyer', note: 'Rohan struggles with geometry and mensuration concepts. Setting up extra tutoring sessions on Saturdays. Parents informed and they have agreed.', category: MentoringCategory.ACADEMIC, isFlagged: false, createdAt: '2024-09-18T09:30:00Z' },
  { noteId: 'mnote-005', studentId: 'student-010', teacherId: 'teacher-005', teacherName: 'Kavita Reddy', note: 'Neha has been complaining of frequent headaches. Recommend a medical check-up. Parents notified via phone call on 20th September.', category: MentoringCategory.HEALTH, isFlagged: true, createdAt: '2024-09-20T15:00:00Z' },
];

// ==================== Dashboard Stats ====================
export const mockDashboardStats = {
  superAdmin: {
    totalTenants: 55,
    activeTenants: 45,
    inactiveTenants: 8,
    suspendedTenants: 2,
    totalUsers: 18500,
    totalStudents: 15200,
    totalTeachers: 1050,
    newTenantsThisMonth: 4,
    totalStorageUsedGb: 312,
    apiRequestsToday: 142000,
    monthlyRevenue: 485000,
    activeUsersToday: 9800,
  },
  schoolAdmin: {
    totalStudents: 1450,
    totalTeachers: 72,
    totalClasses: 24,
    attendanceRateToday: 91.8,
    upcomingExams: 3,
    feeCollectionThisMonth: 520000,
    pendingFees: 185000,
    recentNotifications: 8,
    totalSections: 48,
    activeUsers: 1020,
    newStudentsThisMonth: 12,
    attendanceTrend: [88.5, 90.2, 91.0, 89.8, 92.5, 91.8, 93.1],
    feeCollectionTrend: [480000, 510000, 495000, 520000],
  },
  principal: {
    attendanceRateToday: 93.5,
    attendanceRateMonth: 91.2,
    topPerformers: mockStudents.slice(0, 3),
    lowPerformers: mockStudents.slice(4, 6),
    upcomingExams: mockExams.filter(e => e.status === 'SCHEDULED'),
    feeCollectionRate: 74,
    teacherComplianceRate: 95,
    classWiseAttendance: [
      { className: 'Grade 10', attendance: 93.5 },
      { className: 'Grade 9', attendance: 90.8 },
      { className: 'Grade 8', attendance: 92.1 },
      { className: 'Grade 7', attendance: 89.5 },
      { className: 'Grade 6', attendance: 94.2 },
      { className: 'Grade 5', attendance: 95.8 },
    ],
  },
  teacher: {
    assignedClasses: 4,
    assignedStudents: 148,
    pendingAttendance: true,
    upcomingExams: mockExams.filter(e => e.status === 'SCHEDULED').slice(0, 2),
    recentMessages: 5,
    todaySchedule: mockTimetable.slice(0, 3),
    lowAttendanceStudents: ['Arjun Kumar', 'Karan Malhotra'],
  },
  student: {
    attendancePercentage: 91.5,
    recentMarks: mockExamMarks.filter(m => m.studentId === 'student-001'),
    upcomingMcqExams: mockMcqExams.filter(e => e.status === 'PUBLISHED'),
    unreadNotifications: 4,
    todayTimetable: mockTimetable,
    averageMarks: 82.3,
    rank: 5,
    totalStudentsInClass: 38,
  },
  parent: {
    childAttendance: { studentId: 'student-001', totalDays: 120, presentDays: 110, absentDays: 5, lateDays: 4, halfDays: 1, percentage: 91.7 },
    recentMarks: mockExamMarks.filter(m => m.studentId === 'student-001'),
    feeStatus: { studentId: 'student-001', totalDue: 32500, totalPaid: 30500, outstanding: 2000, payments: [] as typeof mockFeePayments },
    schoolAnnouncements: mockNotifications.filter(n => n.recipientType === 'ALL').slice(0, 3),
    children: [mockStudents[0]],
  },
};

// ==================== Mock Audit Logs ====================
export const mockAuditLogs = [
  { logId: 'audit-001', tenantId: 'tenant-001', userId: 'user-001', userName: 'Vikram Mehta', action: 'CREATE', entityType: 'Student', entityId: 'student-020', details: { firstName: 'Nisha', lastName: 'Rao' }, ipAddress: '192.168.1.100', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { logId: 'audit-002', tenantId: 'tenant-001', userId: 'user-003', userName: 'Ramesh Iyer', action: 'UPDATE', entityType: 'ExamMark', entityId: 'mark-001', details: { examName: 'Mid-Term Mathematics', marksUpdated: 5 }, ipAddress: '192.168.1.101', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { logId: 'audit-003', tenantId: 'tenant-002', userId: 'super-admin-001', userName: 'Rajesh Kapoor', action: 'UPDATE', entityType: 'Tenant', entityId: 'tenant-002', details: { field: 'plan', from: 'STANDARD', to: 'ENTERPRISE' }, ipAddress: '10.0.0.1', timestamp: new Date(Date.now() - 14400000).toISOString() },
  { logId: 'audit-004', tenantId: 'tenant-001', userId: 'user-001', userName: 'Vikram Mehta', action: 'CREATE', entityType: 'Event', entityId: 'event-008', details: { title: 'Annual Cultural Fest - Tarang' }, ipAddress: '192.168.1.100', timestamp: new Date(Date.now() - 28800000).toISOString() },
  { logId: 'audit-005', tenantId: 'tenant-004', userId: 'super-admin-001', userName: 'Rajesh Kapoor', action: 'UPDATE', entityType: 'Tenant', entityId: 'tenant-004', details: { field: 'status', from: 'ACTIVE', to: 'SUSPENDED', reason: 'Payment overdue for 3 months' }, ipAddress: '10.0.0.1', timestamp: new Date(Date.now() - 86400000).toISOString() },
];

// ==================== JWT Token Generation Helper ====================
export const generateMockToken = (user: typeof mockUsers.schoolAdmin, tenantId?: string) => {
  const payload = {
    userId: user.userId,
    tenantId: tenantId || user.tenantId,
    role: user.role,
    featureFlags: mockTenants[0].featureFlags,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return btoa(JSON.stringify(payload));
};
