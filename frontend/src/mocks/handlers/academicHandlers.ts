import { http, HttpResponse, delay } from 'msw';
import { mockStudents, mockExams, mockSubjects, mockClasses } from '../data/mockData';
import { AttendanceStatus } from '../../types';

const API_BASE = '/api';

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

// Mock attendance data
const mockAttendance: Array<{
  attendanceId: string;
  studentId: string;
  student?: typeof mockStudents[0];
  classId: string;
  sectionId: string;
  academicYearId: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string;
  remarks?: string;
  createdAt: string;
}> = [];

// Mock MCQ Questions
const mockQuestions = [
  {
    questionId: 'q-001',
    subjectId: 'sub-001',
    questionText: 'What is the value of π (pi) to 2 decimal places?',
    options: ['3.14', '3.16', '3.12', '3.18'],
    correctOptionIndex: 0,
    difficulty: 'EASY' as const,
    tags: ['geometry', 'constants'],
    createdBy: 'user-003',
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    questionId: 'q-002',
    subjectId: 'sub-001',
    questionText: 'Solve: 2x + 5 = 15',
    options: ['x = 5', 'x = 10', 'x = 7.5', 'x = 4'],
    correctOptionIndex: 0,
    difficulty: 'EASY' as const,
    tags: ['algebra'],
    createdBy: 'user-003',
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    questionId: 'q-003',
    subjectId: 'sub-001',
    questionText: 'What is the derivative of x²?',
    options: ['x', '2x', '2', 'x²'],
    correctOptionIndex: 1,
    difficulty: 'MEDIUM' as const,
    tags: ['calculus'],
    createdBy: 'user-003',
    createdAt: '2024-01-16T00:00:00Z',
  },
  {
    questionId: 'q-004',
    subjectId: 'sub-002',
    questionText: 'What is the SI unit of force?',
    options: ['Joule', 'Newton', 'Watt', 'Pascal'],
    correctOptionIndex: 1,
    difficulty: 'EASY' as const,
    tags: ['physics', 'units'],
    createdBy: 'user-003',
    createdAt: '2024-01-17T00:00:00Z',
  },
  {
    questionId: 'q-005',
    subjectId: 'sub-002',
    questionText: 'What is Newton\'s second law of motion?',
    options: ['F = ma', 'E = mc²', 'P = mv', 'W = Fd'],
    correctOptionIndex: 0,
    difficulty: 'MEDIUM' as const,
    tags: ['physics', 'laws'],
    createdBy: 'user-003',
    createdAt: '2024-01-18T00:00:00Z',
  },
];

// Mock MCQ Exams
const mockMcqExams = [
  {
    examId: 'mcq-001',
    title: 'Mathematics Chapter 5 Quiz',
    subjectId: 'sub-001',
    subjectName: 'Mathematics',
    classIds: ['class-001'],
    questionIds: ['q-001', 'q-002', 'q-003'],
    duration: 30,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    shuffleQuestions: true,
    shuffleOptions: false,
    showResultImmediately: true,
    allowRetake: false,
    allowBackNavigation: true,
    status: 'PUBLISHED' as const,
    createdBy: 'user-003',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    examId: 'mcq-002',
    title: 'Science Unit Test',
    subjectId: 'sub-002',
    subjectName: 'Science',
    classIds: ['class-001', 'class-002'],
    questionIds: ['q-004', 'q-005'],
    duration: 45,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    shuffleQuestions: true,
    shuffleOptions: true,
    showResultImmediately: false,
    allowRetake: false,
    allowBackNavigation: true,
    status: 'PUBLISHED' as const,
    createdBy: 'user-003',
    createdAt: '2024-03-05T00:00:00Z',
  },
  {
    examId: 'mcq-003',
    title: 'Draft Exam',
    subjectId: 'sub-001',
    subjectName: 'Mathematics',
    classIds: ['class-001'],
    questionIds: ['q-001'],
    duration: 15,
    startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    shuffleQuestions: false,
    shuffleOptions: false,
    showResultImmediately: true,
    allowRetake: true,
    allowBackNavigation: true,
    status: 'DRAFT' as const,
    createdBy: 'user-003',
    createdAt: '2024-03-10T00:00:00Z',
  },
];

// Mock exam marks
const mockExamMarks: Array<{
  markId: string;
  examId: string;
  studentId: string;
  student?: typeof mockStudents[0];
  marksObtained: number;
  grade: string;
  remarks?: string;
  enteredBy: string;
  enteredAt: string;
  isLocked: boolean;
}> = [];

export const academicHandlers = [
  // ==================== Attendance ====================
  http.get(`${API_BASE}/attendance`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const classId = url.searchParams.get('classId');
    const sectionId = url.searchParams.get('sectionId');

    let filtered = [...mockAttendance];

    if (classId) {
      filtered = filtered.filter((a) => a.classId === classId);
    }
    if (sectionId) {
      filtered = filtered.filter((a) => a.sectionId === sectionId);
    }

    // Add student details
    filtered = filtered.map((a) => ({
      ...a,
      student: mockStudents.find((s) => s.studentId === a.studentId),
    }));

    return HttpResponse.json({
      success: true,
      message: 'Attendance retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/attendance/by-date`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const classId = url.searchParams.get('classId');
    const sectionId = url.searchParams.get('sectionId');
    const date = url.searchParams.get('date');

    const filtered = mockAttendance.filter(
      (a) => a.classId === classId && a.sectionId === sectionId && a.date === date
    );

    return HttpResponse.json({
      success: true,
      message: 'Attendance retrieved successfully',
      data: filtered,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/attendance/mark`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as {
      classId: string;
      sectionId: string;
      date: string;
      attendances: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>;
    };

    const newAttendances = body.attendances.map((a, index) => ({
      attendanceId: `att-${Date.now()}-${index}`,
      studentId: a.studentId,
      classId: body.classId,
      sectionId: body.sectionId,
      academicYearId: 'ay-001',
      date: body.date,
      status: a.status,
      markedBy: 'user-003',
      remarks: a.remarks,
      createdAt: new Date().toISOString(),
    }));

    // Remove existing and add new
    const existingIds = new Set(body.attendances.map((a) => a.studentId));
    const filtered = mockAttendance.filter(
      (a) => !(a.classId === body.classId && a.sectionId === body.sectionId && a.date === body.date && existingIds.has(a.studentId))
    );
    mockAttendance.length = 0;
    mockAttendance.push(...filtered, ...newAttendances);

    return HttpResponse.json({
      success: true,
      message: 'Attendance marked successfully',
      data: newAttendances,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/attendance/summary/class/:classId`, async ({ params, request }) => {
    await delay(200);
    const url = new URL(request.url);
    const { classId } = params;
    const sectionId = url.searchParams.get('sectionId');
    const date = url.searchParams.get('date');

    // Mock summary
    return HttpResponse.json({
      success: true,
      message: 'Summary retrieved',
      data: {
        totalStudents: 35,
        present: 30,
        absent: 3,
        late: 2,
        halfDay: 0,
        percentage: 91,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== Exams ====================
  http.get(`${API_BASE}/exams`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const subjectId = url.searchParams.get('subjectId');
    const classId = url.searchParams.get('classId');
    const status = url.searchParams.get('status');

    let filtered = [...mockExams];

    if (subjectId) {
      filtered = filtered.filter((e) => e.subjectId === subjectId);
    }
    if (classId) {
      filtered = filtered.filter((e) => e.classIds.includes(classId));
    }
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }

    return HttpResponse.json({
      success: true,
      message: 'Exams retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/exams/upcoming`, async () => {
    await delay(200);

    return HttpResponse.json({
      success: true,
      message: 'Upcoming exams retrieved',
      data: mockExams.filter((e) => e.status === 'SCHEDULED'),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/exams/:examId`, async ({ params }) => {
    await delay(200);
    const { examId } = params;
    const exam = mockExams.find((e) => e.examId === examId);

    if (!exam) {
      return HttpResponse.json(
        { success: false, message: 'Exam not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Exam retrieved successfully',
      data: exam,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/exams`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    const subject = mockSubjects.find((s) => s.subjectId === body.subjectId);

    const newExam = {
      examId: `exam-${Date.now()}`,
      ...body,
      subjectName: subject?.name || '',
      status: 'SCHEDULED',
      createdBy: 'user-003',
      createdAt: new Date().toISOString(),
    };

    mockExams.push(newExam as typeof mockExams[0]);

    return HttpResponse.json({
      success: true,
      message: 'Exam created successfully',
      data: newExam,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.delete(`${API_BASE}/exams/:examId`, async ({ params }) => {
    await delay(400);
    const { examId } = params;
    const index = mockExams.findIndex((e) => e.examId === examId);

    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Exam not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    mockExams.splice(index, 1);

    return HttpResponse.json({
      success: true,
      message: 'Exam deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/exams/:examId/marks`, async ({ params }) => {
    await delay(300);
    const { examId } = params;

    const marks = mockExamMarks
      .filter((m) => m.examId === examId)
      .map((m) => ({
        ...m,
        student: mockStudents.find((s) => s.studentId === m.studentId),
      }));

    return HttpResponse.json({
      success: true,
      message: 'Marks retrieved successfully',
      data: marks,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/exams/:examId/marks/bulk`, async ({ params, request }) => {
    await delay(500);
    const { examId } = params;
    const body = (await request.json()) as { marks: Array<{ studentId: string; marksObtained: number; remarks?: string }> };

    const newMarks = body.marks.map((m, index) => ({
      markId: `mark-${Date.now()}-${index}`,
      examId: examId as string,
      studentId: m.studentId,
      marksObtained: m.marksObtained,
      grade: m.marksObtained >= 90 ? 'A+' : m.marksObtained >= 80 ? 'A' : m.marksObtained >= 70 ? 'B+' : m.marksObtained >= 60 ? 'B' : 'C',
      remarks: m.remarks,
      enteredBy: 'user-003',
      enteredAt: new Date().toISOString(),
      isLocked: false,
    }));

    // Remove existing marks for these students
    const studentIds = new Set(body.marks.map((m) => m.studentId));
    const filtered = mockExamMarks.filter((m) => !(m.examId === examId && studentIds.has(m.studentId)));
    mockExamMarks.length = 0;
    mockExamMarks.push(...filtered, ...newMarks);

    return HttpResponse.json({
      success: true,
      message: 'Marks saved successfully',
      data: newMarks,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/exams/:examId/marks/summary`, async ({ params }) => {
    await delay(200);
    const { examId } = params;
    const marks = mockExamMarks.filter((m) => m.examId === examId);

    if (marks.length === 0) {
      return HttpResponse.json({
        success: true,
        message: 'Summary retrieved',
        data: {
          totalStudents: 0,
          passed: 0,
          failed: 0,
          highestMarks: 0,
          lowestMarks: 0,
          averageMarks: 0,
          passPercentage: 0,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const scores = marks.map((m) => m.marksObtained);
    const passed = marks.filter((m) => m.marksObtained >= 35).length;

    return HttpResponse.json({
      success: true,
      message: 'Summary retrieved',
      data: {
        totalStudents: marks.length,
        passed,
        failed: marks.length - passed,
        highestMarks: Math.max(...scores),
        lowestMarks: Math.min(...scores),
        averageMarks: scores.reduce((a, b) => a + b, 0) / scores.length,
        passPercentage: (passed / marks.length) * 100,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${API_BASE}/exams/:examId/marks/lock`, async ({ params }) => {
    await delay(300);
    const { examId } = params;

    mockExamMarks.forEach((m) => {
      if (m.examId === examId) {
        m.isLocked = true;
      }
    });

    return HttpResponse.json({
      success: true,
      message: 'Marks locked successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== MCQ Questions ====================
  http.get(`${API_BASE}/mcq/questions`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const subjectId = url.searchParams.get('subjectId');
    const difficulty = url.searchParams.get('difficulty');
    const search = url.searchParams.get('search');

    let filtered = [...mockQuestions];

    if (subjectId) {
      filtered = filtered.filter((q) => q.subjectId === subjectId);
    }
    if (difficulty) {
      filtered = filtered.filter((q) => q.difficulty === difficulty);
    }
    if (search) {
      filtered = filtered.filter((q) => q.questionText.toLowerCase().includes(search.toLowerCase()));
    }

    return HttpResponse.json({
      success: true,
      message: 'Questions retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/mcq/questions`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as Record<string, unknown>;

    const newQuestion = {
      questionId: `q-${Date.now()}`,
      ...body,
      createdBy: 'user-003',
      createdAt: new Date().toISOString(),
    };

    mockQuestions.push(newQuestion as typeof mockQuestions[0]);

    return HttpResponse.json({
      success: true,
      message: 'Question created successfully',
      data: newQuestion,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/mcq/questions/:questionId`, async ({ params, request }) => {
    await delay(400);
    const { questionId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const index = mockQuestions.findIndex((q) => q.questionId === questionId);

    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Question not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    mockQuestions[index] = { ...mockQuestions[index], ...body };

    return HttpResponse.json({
      success: true,
      message: 'Question updated successfully',
      data: mockQuestions[index],
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/mcq/questions/:questionId`, async ({ params }) => {
    await delay(400);
    const { questionId } = params;
    const index = mockQuestions.findIndex((q) => q.questionId === questionId);

    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Question not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    mockQuestions.splice(index, 1);

    return HttpResponse.json({
      success: true,
      message: 'Question deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // ==================== MCQ Exams ====================
  http.get(`${API_BASE}/mcq/exams`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const size = parseInt(url.searchParams.get('size') || '10');
    const subjectId = url.searchParams.get('subjectId');
    const status = url.searchParams.get('status');

    let filtered = [...mockMcqExams];

    if (subjectId) {
      filtered = filtered.filter((e) => e.subjectId === subjectId);
    }
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }

    return HttpResponse.json({
      success: true,
      message: 'MCQ Exams retrieved successfully',
      data: paginate(filtered, page, size),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/mcq/exams/available`, async () => {
    await delay(200);

    const available = mockMcqExams.filter(
      (e) => e.status === 'PUBLISHED' && new Date(e.endTime) > new Date()
    );

    return HttpResponse.json({
      success: true,
      message: 'Available MCQ exams retrieved',
      data: available,
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${API_BASE}/mcq/exams/:examId/publish`, async ({ params }) => {
    await delay(400);
    const { examId } = params;
    const exam = mockMcqExams.find((e) => e.examId === examId);

    if (!exam) {
      return HttpResponse.json(
        { success: false, message: 'Exam not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    exam.status = 'PUBLISHED';

    return HttpResponse.json({
      success: true,
      message: 'MCQ Exam published successfully',
      data: exam,
      timestamp: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/mcq/exams/:examId`, async ({ params }) => {
    await delay(400);
    const { examId } = params;
    const index = mockMcqExams.findIndex((e) => e.examId === examId);

    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Exam not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    mockMcqExams.splice(index, 1);

    return HttpResponse.json({
      success: true,
      message: 'MCQ Exam deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  // Student exam taking
  http.post(`${API_BASE}/mcq/exams/:examId/start`, async ({ params }) => {
    await delay(500);
    const { examId } = params;
    const exam = mockMcqExams.find((e) => e.examId === examId);

    if (!exam) {
      return HttpResponse.json(
        { success: false, message: 'Exam not found', data: null, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const questions = exam.questionIds
      .map((qId) => mockQuestions.find((q) => q.questionId === qId))
      .filter(Boolean)
      .map((q) => ({
        questionId: q!.questionId,
        questionText: q!.questionText,
        options: q!.options,
      }));

    return HttpResponse.json({
      success: true,
      message: 'Exam started',
      data: {
        attempt: {
          attemptId: `attempt-${Date.now()}`,
          examId,
          studentId: 'user-004',
          answers: [],
          score: 0,
          totalQuestions: questions.length,
          correctAnswers: 0,
          startedAt: new Date().toISOString(),
          status: 'IN_PROGRESS',
        },
        questions,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/mcq/attempts/:attemptId/answer`, async () => {
    await delay(100);

    return HttpResponse.json({
      success: true,
      message: 'Answer submitted',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/mcq/attempts/:attemptId/submit`, async ({ params }) => {
    await delay(500);
    const { attemptId } = params;

    // In a real app, we'd calculate the actual score from saved answers
    // For mock, we return a random score
    const totalQuestions = 5;
    const correctAnswers = Math.floor(Math.random() * (totalQuestions + 1));

    return HttpResponse.json({
      success: true,
      message: 'Exam submitted successfully',
      data: {
        attemptId,
        examId: 'mcq-001',
        studentId: 'user-004',
        score: correctAnswers,
        totalQuestions,
        correctAnswers,
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED',
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/mcq/attempts/:attemptId/result`, async ({ params }) => {
    await delay(300);
    const { attemptId } = params;

    // Mock result with details
    return HttpResponse.json({
      success: true,
      message: 'Result retrieved',
      data: {
        attempt: {
          attemptId,
          examId: 'mcq-001',
          studentId: 'user-004',
          score: 3,
          totalQuestions: 5,
          correctAnswers: 3,
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          submittedAt: new Date().toISOString(),
          status: 'SUBMITTED',
        },
        details: mockQuestions.slice(0, 5).map((q, i) => ({
          questionId: q.questionId,
          questionText: q.questionText,
          options: q.options,
          selectedOptionIndex: i % 2 === 0 ? q.correctOptionIndex : (q.correctOptionIndex + 1) % 4,
          correctOptionIndex: q.correctOptionIndex,
          isCorrect: i % 2 === 0,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  }),
];
