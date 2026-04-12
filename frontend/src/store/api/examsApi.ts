import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  Exam,
  ExamMark,
  BulkImportResult,
} from '../../types';

interface GetExamsParams {
  page?: number;
  size?: number;
  academicYearId?: string;
  classId?: string;
  subjectId?: string;
  status?: 'SCHEDULED' | 'ONGOING' | 'COMPLETED';
  startDate?: string;
  endDate?: string;
}

export const examsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all exams
    getExams: builder.query<ApiResponse<PaginatedResponse<Exam>>, GetExamsParams>({
      query: (params) => ({
        url: '/exams',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ examId }) => ({
                type: 'Exam' as const,
                id: examId,
              })),
              { type: 'Exams', id: 'LIST' },
            ]
          : [{ type: 'Exams', id: 'LIST' }],
    }),

    // Get exam by ID
    getExamById: builder.query<ApiResponse<Exam>, string>({
      query: (examId) => `/exams/${examId}`,
      providesTags: (result, error, examId) => [{ type: 'Exam', id: examId }],
    }),

    // Create exam
    createExam: builder.mutation<
      ApiResponse<Exam>,
      {
        name: string;
        academicYearId: string;
        classIds: string[];
        subjectId: string;
        date: string;
        startTime: string;
        endTime: string;
        maxMarks: number;
        passingMarks: number;
      }
    >({
      query: (body) => ({
        url: '/exams',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Exams', id: 'LIST' }, 'Dashboard'],
    }),

    // Update exam
    updateExam: builder.mutation<
      ApiResponse<Exam>,
      { examId: string; data: Partial<Exam> }
    >({
      query: ({ examId, data }) => ({
        url: `/exams/${examId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { examId }) => [
        { type: 'Exam', id: examId },
        { type: 'Exams', id: 'LIST' },
      ],
    }),

    // Delete exam
    deleteExam: builder.mutation<ApiResponse<null>, string>({
      query: (examId) => ({
        url: `/exams/${examId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Exams', id: 'LIST' }, 'Dashboard'],
    }),

    // Get exam marks
    getExamMarks: builder.query<
      ApiResponse<ExamMark[]>,
      { examId: string; classId?: string; sectionId?: string }
    >({
      query: ({ examId, ...params }) => ({
        url: `/exams/${examId}/marks`,
        params,
      }),
      providesTags: (result, error, { examId }) => [{ type: 'Exam', id: examId }],
    }),

    // Enter marks (single student)
    enterMark: builder.mutation<
      ApiResponse<ExamMark>,
      {
        examId: string;
        studentId: string;
        marksObtained: number;
        remarks?: string;
      }
    >({
      query: ({ examId, ...body }) => ({
        url: `/exams/${examId}/marks`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { examId }) => [
        { type: 'Exam', id: examId },
      ],
    }),

    // Enter marks (bulk)
    enterMarksBulk: builder.mutation<
      ApiResponse<ExamMark[]>,
      {
        examId: string;
        marks: { studentId: string; marksObtained: number; remarks?: string }[];
      }
    >({
      query: ({ examId, marks }) => ({
        url: `/exams/${examId}/marks/bulk`,
        method: 'POST',
        body: { marks },
      }),
      invalidatesTags: (result, error, { examId }) => [
        { type: 'Exam', id: examId },
        'Dashboard',
      ],
    }),

    // Update mark
    updateMark: builder.mutation<
      ApiResponse<ExamMark>,
      {
        examId: string;
        markId: string;
        marksObtained: number;
        remarks?: string;
      }
    >({
      query: ({ examId, markId, ...body }) => ({
        url: `/exams/${examId}/marks/${markId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { examId }) => [
        { type: 'Exam', id: examId },
      ],
    }),

    // Lock marks (no more edits allowed without admin approval)
    lockMarks: builder.mutation<ApiResponse<null>, string>({
      query: (examId) => ({
        url: `/exams/${examId}/marks/lock`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, examId) => [{ type: 'Exam', id: examId }],
    }),

    // Get marks summary
    getMarksSummary: builder.query<
      ApiResponse<{
        totalStudents: number;
        passed: number;
        failed: number;
        highestMarks: number;
        lowestMarks: number;
        averageMarks: number;
        passPercentage: number;
      }>,
      { examId: string; classId?: string; sectionId?: string }
    >({
      query: ({ examId, ...params }) => ({
        url: `/exams/${examId}/marks/summary`,
        params,
      }),
      providesTags: (result, error, { examId }) => [{ type: 'Exam', id: examId }],
    }),

    // Bulk upload marks
    bulkUploadMarks: builder.mutation<
      ApiResponse<BulkImportResult>,
      { examId: string; file: FormData }
    >({
      query: ({ examId, file }) => ({
        url: `/exams/${examId}/marks/bulk-upload`,
        method: 'POST',
        body: file,
        formData: true,
      }),
      invalidatesTags: (result, error, { examId }) => [
        { type: 'Exam', id: examId },
        'Dashboard',
      ],
    }),

    // Get upcoming exams
    getUpcomingExams: builder.query<
      ApiResponse<Exam[]>,
      { days?: number; classId?: string; teacherId?: string }
    >({
      query: (params) => ({
        url: '/exams/upcoming',
        params,
      }),
      providesTags: ['Exams', 'Dashboard'],
    }),
  }),
});

export const {
  useGetExamsQuery,
  useGetExamByIdQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
  useGetExamMarksQuery,
  useEnterMarkMutation,
  useEnterMarksBulkMutation,
  useUpdateMarkMutation,
  useLockMarksMutation,
  useGetMarksSummaryQuery,
  useBulkUploadMarksMutation,
  useGetUpcomingExamsQuery,
} = examsApi;
