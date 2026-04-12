import { http, HttpResponse, delay } from 'msw';
import {
  mockUsersList, mockStudents, mockTeachers, mockClasses, mockSubjects, mockAcademicYears,
  mockAttendance, mockExams, mockExamMarks, mockFeeStructures, mockFeePayments,
  mockEvents, mockMcqQuestions, mockMcqExams, mockTimetable, mockMentoringNotes,
} from '../data/mockData';

const API_BASE = '/api/v1';

// Helper to create paginated response
const paginate = <T>(items: T[], page = 0, size = 10) => {
  const start = page * size;
  const end = start + size;
  const content = items.slice(start, end);
  return {
    content,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
    page,
    size,
  };
};

// Helper to filter items
const filterBySearch = <T extends { [key: string]: unknown }>(
  items: T[],
  search: string | null,
  searchFields: string[]
): T[] => {
  if (!search) return items;
  const lowerSearch = search.toLowerCase();
  return items.filter((item) =>
    searchFields.some((field) => {
      const value = field.split('.').reduce((obj, key) => (obj as Record<string, unknown>)?.[key], item as unknown);
      return typeof value === 'string' && value.toLowerCase().includes(lowerSearch);
    })
  );
};

export const coreHandlers = [
  // ==================== Users ====================
  http.get(`${API_BASE}/users`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const search = url.searchParams.get('search');
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');

    let filtered = [...mockUsersList];

    if (search) {
      filtered = filterBySearch(filtered, search, ['firstName', 'lastName', 'email']);
    }

    if (role) {
      filtered = filtered.filter((u) => u.role === role);
    }

    if (status === 'active') {
      filtered = filtered.filter((u) => u.isActive && !u.isLocked);
    } else if (status === 'inactive') {
      filtered = filtered.filter((u) => !u.isActive);
    } else if (status === 'locked') {
      filtered = filtered.filter((u) => u.isLocked);
    }

    return HttpResponse.json({
      success: true,
      message: 'Users retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/users/:userId`, async ({ params }) => {
    await delay(200);
    const { userId } = params;
    const user = mockUsersList.find((u) => u.userId === userId);

    if (!user) {
      return HttpResponse.json(
        { success: false, message: 'User not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'User retrieved successfully',
      data: user,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/users`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    const newUser = {
      userId: `user-${Date.now()}`,
      tenantId: 'tenant-001',
      ...body,
      profilePhotoUrl: '',
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      message: 'User created successfully',
      data: newUser,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/users/:userId`, async ({ params, request }) => {
    await delay(400);
    const { userId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const user = mockUsersList.find((u) => u.userId === userId);

    if (!user) {
      return HttpResponse.json(
        { success: false, message: 'User not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const updatedUser = { ...user, ...body, updatedAt: new Date().toISOString() };

    return HttpResponse.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${API_BASE}/users/:userId/status`, async ({ params, request }) => {
    await delay(300);
    const { userId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const user = mockUsersList.find((u) => u.userId === userId);

    if (!user) {
      return HttpResponse.json(
        { success: false, message: 'User not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'User status updated successfully',
      data: { ...user, isActive: body.isActive },
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${API_BASE}/users/:userId/unlock`, async ({ params }) => {
    await delay(300);
    const { userId } = params;
    const user = mockUsersList.find((u) => u.userId === userId);

    if (!user) {
      return HttpResponse.json(
        { success: false, message: 'User not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'User unlocked successfully',
      data: { ...user, isLocked: false, failedLoginAttempts: 0 },
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/users/:userId`, async ({ params }) => {
    await delay(400);
    const { userId } = params;
    const userIndex = mockUsersList.findIndex((u) => u.userId === userId);

    if (userIndex === -1) {
      return HttpResponse.json(
        { success: false, message: 'User not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'User deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Students ====================
  http.get(`${API_BASE}/students`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const search = url.searchParams.get('search');
    const classId = url.searchParams.get('classId');
    const sectionId = url.searchParams.get('sectionId');
    const gender = url.searchParams.get('gender');

    let filtered = [...mockStudents];

    if (search) {
      filtered = filterBySearch(filtered, search, ['user.firstName', 'user.lastName', 'admissionNumber', 'rollNumber']);
    }

    if (classId) {
      filtered = filtered.filter((s) => s.classId === classId);
    }

    if (sectionId) {
      filtered = filtered.filter((s) => s.sectionId === sectionId);
    }

    if (gender) {
      filtered = filtered.filter((s) => s.gender === gender);
    }

    return HttpResponse.json({
      success: true,
      message: 'Students retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/students/:studentId`, async ({ params }) => {
    await delay(200);
    const { studentId } = params;
    const student = mockStudents.find((s) => s.studentId === studentId);

    if (!student) {
      return HttpResponse.json(
        { success: false, message: 'Student not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Student retrieved successfully',
      data: student,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/students`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    const classInfo = mockClasses.find((c) => c.classId === body.classId);
    const sectionInfo = classInfo?.sections.find((s) => s.sectionId === body.sectionId);

    const newStudent = {
      studentId: `student-${Date.now()}`,
      userId: `user-${Date.now()}`,
      user: {
        userId: `user-${Date.now()}`,
        tenantId: 'tenant-001',
        email: body.email,
        role: 'STUDENT',
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        profilePhotoUrl: '',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      rollNumber: body.rollNumber,
      admissionNumber: body.admissionNumber,
      classId: body.classId,
      className: classInfo?.name || '',
      sectionId: body.sectionId,
      sectionName: sectionInfo?.name || '',
      parentIds: [],
      dateOfBirth: body.dateOfBirth,
      gender: body.gender,
      bloodGroup: body.bloodGroup,
      address: body.address,
      academicHistory: [],
      documents: [],
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      message: 'Student created successfully',
      data: newStudent,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/students/:studentId`, async ({ params, request }) => {
    await delay(400);
    const { studentId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const student = mockStudents.find((s) => s.studentId === studentId);

    if (!student) {
      return HttpResponse.json(
        { success: false, message: 'Student not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Student updated successfully',
      data: { ...student, ...body },
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/students/:studentId`, async ({ params }) => {
    await delay(400);
    const { studentId } = params;
    const studentIndex = mockStudents.findIndex((s) => s.studentId === studentId);

    if (studentIndex === -1) {
      return HttpResponse.json(
        { success: false, message: 'Student not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Student deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Teachers ====================
  http.get(`${API_BASE}/teachers`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const search = url.searchParams.get('search');
    const subjectId = url.searchParams.get('subjectId');
    const classId = url.searchParams.get('classId');

    let filtered = [...mockTeachers];

    if (search) {
      filtered = filterBySearch(filtered, search, ['user.firstName', 'user.lastName', 'employeeId']);
    }

    if (subjectId) {
      filtered = filtered.filter((t) => t.subjectIds.includes(subjectId));
    }

    if (classId) {
      filtered = filtered.filter((t) => t.classIds.includes(classId));
    }

    return HttpResponse.json({
      success: true,
      message: 'Teachers retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/teachers/:teacherId`, async ({ params }) => {
    await delay(200);
    const { teacherId } = params;
    const teacher = mockTeachers.find((t) => t.teacherId === teacherId);

    if (!teacher) {
      return HttpResponse.json(
        { success: false, message: 'Teacher not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Teacher retrieved successfully',
      data: teacher,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/teachers`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;

    const newTeacher = {
      teacherId: `teacher-${Date.now()}`,
      userId: `user-${Date.now()}`,
      user: {
        userId: `user-${Date.now()}`,
        tenantId: 'tenant-001',
        email: body.email,
        role: 'TEACHER',
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        profilePhotoUrl: '',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      employeeId: body.employeeId,
      qualification: body.qualification,
      specialization: body.specialization,
      subjectIds: [],
      subjects: [],
      classIds: [],
      sectionIds: [],
      isClassTeacher: false,
      classTeacherOf: null,
      joiningDate: body.joiningDate,
      documents: [],
    };

    return HttpResponse.json({
      success: true,
      message: 'Teacher created successfully',
      data: newTeacher,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/teachers/:teacherId`, async ({ params, request }) => {
    await delay(400);
    const { teacherId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const teacher = mockTeachers.find((t) => t.teacherId === teacherId);

    if (!teacher) {
      return HttpResponse.json(
        { success: false, message: 'Teacher not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Teacher updated successfully',
      data: { ...teacher, ...body },
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/teachers/:teacherId`, async ({ params }) => {
    await delay(400);
    const { teacherId } = params;
    const teacherIndex = mockTeachers.findIndex((t) => t.teacherId === teacherId);

    if (teacherIndex === -1) {
      return HttpResponse.json(
        { success: false, message: 'Teacher not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Teacher deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Classes ====================
  http.get(`${API_BASE}/classes`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const academicYearId = url.searchParams.get('academicYearId');

    let filtered = [...mockClasses];

    if (academicYearId) {
      filtered = filtered.filter((c) => c.academicYearId === academicYearId);
    }

    return HttpResponse.json({
      success: true,
      message: 'Classes retrieved successfully',
      data: filtered,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/classes/:classId`, async ({ params }) => {
    await delay(200);
    const { classId } = params;
    const cls = mockClasses.find((c) => c.classId === classId);

    if (!cls) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Class retrieved successfully',
      data: cls,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/classes`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;

    const newClass = {
      classId: `class-${Date.now()}`,
      name: body.name,
      grade: body.grade,
      academicYearId: body.academicYearId,
      sections: [],
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      message: 'Class created successfully',
      data: newClass,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/classes/:classId`, async ({ params, request }) => {
    await delay(400);
    const { classId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const cls = mockClasses.find((c) => c.classId === classId);

    if (!cls) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Class updated successfully',
      data: { ...cls, ...body },
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/classes/:classId`, async ({ params }) => {
    await delay(400);
    const { classId } = params;
    const classIndex = mockClasses.findIndex((c) => c.classId === classId);

    if (classIndex === -1) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Class deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Sections ====================
  http.get(`${API_BASE}/classes/:classId/sections`, async ({ params }) => {
    await delay(200);
    const { classId } = params;
    const cls = mockClasses.find((c) => c.classId === classId);

    if (!cls) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Sections retrieved successfully',
      data: cls.sections,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/classes/:classId/sections`, async ({ params, request }) => {
    await delay(400);
    const { classId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const cls = mockClasses.find((c) => c.classId === classId);

    if (!cls) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const teacher = body.classTeacherId
      ? mockTeachers.find((t) => t.teacherId === body.classTeacherId)
      : null;

    const newSection = {
      sectionId: `sec-${Date.now()}`,
      classId: classId as string,
      name: body.name,
      capacity: body.capacity,
      classTeacherId: body.classTeacherId || null,
      classTeacherName: teacher ? `${teacher.user.firstName} ${teacher.user.lastName}` : null,
      studentCount: 0,
    };

    return HttpResponse.json({
      success: true,
      message: 'Section created successfully',
      data: newSection,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/classes/:classId/sections/:sectionId`, async ({ params, request }) => {
    await delay(400);
    const { classId, sectionId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const cls = mockClasses.find((c) => c.classId === classId);

    if (!cls) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const section = cls.sections.find((s) => s.sectionId === sectionId);

    if (!section) {
      return HttpResponse.json(
        { success: false, message: 'Section not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Section updated successfully',
      data: { ...section, ...body },
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/classes/:classId/sections/:sectionId`, async ({ params }) => {
    await delay(400);
    const { classId, sectionId } = params;
    const cls = mockClasses.find((c) => c.classId === classId);

    if (!cls) {
      return HttpResponse.json(
        { success: false, message: 'Class not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const sectionIndex = cls.sections.findIndex((s) => s.sectionId === sectionId);

    if (sectionIndex === -1) {
      return HttpResponse.json(
        { success: false, message: 'Section not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Section deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Subjects ====================
  http.get(`${API_BASE}/subjects`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');

    let filtered = [...mockSubjects];

    if (classId) {
      filtered = filtered.filter((s) => s.classIds.includes(classId));
    }

    return HttpResponse.json({
      success: true,
      message: 'Subjects retrieved successfully',
      data: filtered,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Academic Years ====================
  http.get(`${API_BASE}/academic-years`, async () => {
    await delay(200);

    return HttpResponse.json({
      success: true,
      message: 'Academic years retrieved successfully',
      data: mockAcademicYears,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/academic-years`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { label: string; startDate: string; endDate: string };

    const newYear = {
      academicYearId: `ay-${Date.now()}`,
      label: body.label,
      startDate: body.startDate,
      endDate: body.endDate,
      isCurrent: false,
      status: 'ACTIVE',
    };

    mockAcademicYears.push(newYear);

    return HttpResponse.json({
      success: true,
      message: 'Academic year created successfully',
      data: newYear,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.patch(`${API_BASE}/academic-years/:id/set-current`, async ({ params }) => {
    await delay(300);
    const { id } = params;

    mockAcademicYears.forEach((ay) => {
      ay.isCurrent = ay.academicYearId === id;
    });

    const year = mockAcademicYears.find((ay) => ay.academicYearId === id);

    return HttpResponse.json({
      success: true,
      message: 'Academic year set as current',
      data: year,
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${API_BASE}/academic-years/:id/archive`, async ({ params }) => {
    await delay(300);
    const { id } = params;

    const year = mockAcademicYears.find((ay) => ay.academicYearId === id);
    if (year) {
      year.status = 'ARCHIVED';
    }

    return HttpResponse.json({
      success: true,
      message: 'Academic year archived',
      data: year,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Attendance ====================
  http.get(`${API_BASE}/attendance/class/:classId`, async ({ params }) => {
    await delay(300);
    const { classId } = params;
    const filtered = mockAttendance.filter((a) => a.classId === classId);
    return HttpResponse.json({
      success: true,
      message: 'Attendance retrieved successfully',
      data: filtered,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/attendance/mark`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Attendance marked successfully',
      data: body,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/attendance/summary/student/:studentId`, async ({ params }) => {
    await delay(300);
    const { studentId } = params;
    return HttpResponse.json({
      success: true,
      message: 'Attendance summary retrieved',
      data: {
        studentId,
        totalDays: 90,
        present: 82,
        absent: 4,
        late: 3,
        halfDay: 1,
        attendancePercentage: 92.5,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Exams ====================
  http.get(`${API_BASE}/exams`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Exams retrieved successfully',
      data: mockExams,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/exams`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Exam created successfully',
      data: {
        examId: `exam-${Date.now()}`,
        ...body,
        status: 'SCHEDULED',
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/exams/:examId/marks`, async ({ params }) => {
    await delay(300);
    const { examId } = params;
    const marks = mockExamMarks.filter((m) => m.examId === examId);
    return HttpResponse.json({
      success: true,
      message: 'Marks retrieved successfully',
      data: marks,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/exams/marks`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Marks entered successfully',
      data: body,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Fees ====================
  http.get(`${API_BASE}/fees/structures`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Fee structures retrieved successfully',
      data: mockFeeStructures,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/fees/structures`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Fee structure created successfully',
      data: {
        feeStructureId: `fee-str-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/fees/payments/student/:studentId`, async ({ params }) => {
    await delay(300);
    const { studentId } = params;
    const payments = mockFeePayments.filter((p) => p.studentId === studentId);
    return HttpResponse.json({
      success: true,
      message: 'Fee payments retrieved successfully',
      data: payments,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/fees/payments`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId: `pay-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  // ==================== Events ====================
  http.get(`${API_BASE}/events`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Events retrieved successfully',
      data: mockEvents,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/events`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Event created successfully',
      data: {
        eventId: `event-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/events/:id`, async ({ params, request }) => {
    await delay(400);
    const { id } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const event = mockEvents.find((e) => e.eventId === id);

    if (!event) {
      return HttpResponse.json(
        { success: false, message: 'Event not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Event updated successfully',
      data: { ...event, ...body },
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/events/:id`, async ({ params }) => {
    await delay(400);
    const { id } = params;
    const eventIndex = mockEvents.findIndex((e) => e.eventId === id);

    if (eventIndex === -1) {
      return HttpResponse.json(
        { success: false, message: 'Event not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Event deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== MCQ ====================
  http.get(`${API_BASE}/mcq/questions`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'MCQ questions retrieved successfully',
      data: mockMcqQuestions,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/mcq/questions`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Question created successfully',
      data: {
        questionId: `mcq-q-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/mcq/exams`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'MCQ exams retrieved successfully',
      data: mockMcqExams,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/mcq/exams`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'MCQ exam created successfully',
      data: {
        examId: `mcq-exam-${Date.now()}`,
        ...body,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  // ==================== Timetable ====================
  http.get(`${API_BASE}/timetable`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Timetable retrieved successfully',
      data: mockTimetable,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Mentoring ====================
  http.get(`${API_BASE}/students/:studentId/mentoring-notes`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Mentoring notes retrieved successfully',
      data: mockMentoringNotes,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/students/:studentId/mentoring-notes`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Mentoring note created successfully',
      data: {
        noteId: `mnote-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  // ==================== Settings ====================
  http.get(`${API_BASE}/settings`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      message: 'Settings retrieved successfully',
      data: {
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
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.put(`${API_BASE}/settings`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        settingsId: 'settings-001',
        tenantId: 'tenant-001',
        ...body,
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }),
];
