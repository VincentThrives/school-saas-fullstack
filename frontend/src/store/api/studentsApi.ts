import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  Student,
  CreateStudentRequest,
  AttendanceSummary,
  ExamMark,
  FeeStatus,
  MentoringNote,
  BulkImportResult,
  Gender,
} from '../../types';

interface GetStudentsParams {
  page?: number;
  size?: number;
  classId?: string;
  sectionId?: string;
  search?: string;
  gender?: Gender;
  academicYearId?: string;
}

export const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all students
    getStudents: builder.query<
      ApiResponse<PaginatedResponse<Student>>,
      GetStudentsParams
    >({
      query: (params) => ({
        url: '/students',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ studentId }) => ({
                type: 'Student' as const,
                id: studentId,
              })),
              { type: 'Students', id: 'LIST' },
            ]
          : [{ type: 'Students', id: 'LIST' }],
    }),

    // Get student by ID
    getStudentById: builder.query<ApiResponse<Student>, string>({
      query: (studentId) => `/students/${studentId}`,
      providesTags: (result, error, studentId) => [
        { type: 'Student', id: studentId },
      ],
    }),

    // Create student
    createStudent: builder.mutation<ApiResponse<Student>, CreateStudentRequest>({
      query: (body) => ({
        url: '/students',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Students', id: 'LIST' }, 'Dashboard'],
    }),

    // Update student
    updateStudent: builder.mutation<
      ApiResponse<Student>,
      { studentId: string; data: Partial<CreateStudentRequest> }
    >({
      query: ({ studentId, data }) => ({
        url: `/students/${studentId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { studentId }) => [
        { type: 'Student', id: studentId },
        { type: 'Students', id: 'LIST' },
      ],
    }),

    // Delete student
    deleteStudent: builder.mutation<ApiResponse<null>, string>({
      query: (studentId) => ({
        url: `/students/${studentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Students', id: 'LIST' }, 'Dashboard'],
    }),

    // Get student attendance summary
    getStudentAttendance: builder.query<
      ApiResponse<AttendanceSummary>,
      { studentId: string; academicYearId?: string }
    >({
      query: ({ studentId, ...params }) => ({
        url: `/students/${studentId}/attendance`,
        params,
      }),
      providesTags: (result, error, { studentId }) => [
        { type: 'Attendance', id: studentId },
      ],
    }),

    // Get student marks
    getStudentMarks: builder.query<
      ApiResponse<ExamMark[]>,
      { studentId: string; examId?: string; subjectId?: string }
    >({
      query: ({ studentId, ...params }) => ({
        url: `/students/${studentId}/marks`,
        params,
      }),
      providesTags: (result, error, { studentId }) => [
        { type: 'Student', id: studentId },
      ],
    }),

    // Get student report card
    getStudentReportCard: builder.query<
      Blob,
      { studentId: string; academicYearId: string; examId?: string }
    >({
      query: ({ studentId, ...params }) => ({
        url: `/students/${studentId}/report-card`,
        params,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Get student fee status
    getStudentFeeStatus: builder.query<ApiResponse<FeeStatus>, string>({
      query: (studentId) => `/students/${studentId}/fee-status`,
      providesTags: ['FeePayment'],
    }),

    // Get student mentoring notes
    getStudentMentoringNotes: builder.query<
      ApiResponse<MentoringNote[]>,
      string
    >({
      query: (studentId) => `/students/${studentId}/mentoring-notes`,
      providesTags: (result, error, studentId) => [
        { type: 'MentoringNotes', id: studentId },
      ],
    }),

    // Add mentoring note
    addMentoringNote: builder.mutation<
      ApiResponse<MentoringNote>,
      {
        studentId: string;
        note: string;
        category: MentoringNote['category'];
        isFlagged?: boolean;
      }
    >({
      query: ({ studentId, ...body }) => ({
        url: `/students/${studentId}/mentoring-notes`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { studentId }) => [
        { type: 'MentoringNotes', id: studentId },
      ],
    }),

    // Bulk import students
    bulkImportStudents: builder.mutation<
      ApiResponse<BulkImportResult>,
      FormData
    >({
      query: (body) => ({
        url: '/students/bulk-import',
        method: 'POST',
        body,
        formData: true,
      }),
      invalidatesTags: [{ type: 'Students', id: 'LIST' }, 'Dashboard'],
    }),

    // Bulk promote students
    bulkPromoteStudents: builder.mutation<
      ApiResponse<{ promoted: number; failed: number }>,
      {
        fromClassId: string;
        fromSectionId: string;
        toClassId: string;
        toSectionId: string;
        studentIds?: string[];
        excludeStudentIds?: string[];
      }
    >({
      query: (body) => ({
        url: '/students/bulk-promote',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Students', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetStudentByIdQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useGetStudentAttendanceQuery,
  useGetStudentMarksQuery,
  useGetStudentReportCardQuery,
  useGetStudentFeeStatusQuery,
  useGetStudentMentoringNotesQuery,
  useAddMentoringNoteMutation,
  useBulkImportStudentsMutation,
  useBulkPromoteStudentsMutation,
} = studentsApi;
