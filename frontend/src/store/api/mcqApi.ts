import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  McqQuestion,
  McqExam,
  McqAttempt,
} from '../../types';

interface GetQuestionsParams {
  page?: number;
  size?: number;
  subjectId?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  tags?: string[];
  search?: string;
}

interface GetMcqExamsParams {
  page?: number;
  size?: number;
  subjectId?: string;
  classId?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED';
}

export const mcqApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Questions ====================
    getQuestions: builder.query<
      ApiResponse<PaginatedResponse<McqQuestion>>,
      GetQuestionsParams
    >({
      query: (params) => ({
        url: '/mcq/questions',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ questionId }) => ({
                type: 'McqQuestion' as const,
                id: questionId,
              })),
              { type: 'McqQuestions', id: 'LIST' },
            ]
          : [{ type: 'McqQuestions', id: 'LIST' }],
    }),

    getQuestionById: builder.query<ApiResponse<McqQuestion>, string>({
      query: (questionId) => `/mcq/questions/${questionId}`,
      providesTags: (result, error, questionId) => [
        { type: 'McqQuestion', id: questionId },
      ],
    }),

    createQuestion: builder.mutation<
      ApiResponse<McqQuestion>,
      {
        subjectId: string;
        questionText: string;
        options: string[];
        correctOptionIndex: number;
        difficulty: 'EASY' | 'MEDIUM' | 'HARD';
        tags?: string[];
      }
    >({
      query: (body) => ({
        url: '/mcq/questions',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'McqQuestions', id: 'LIST' }],
    }),

    updateQuestion: builder.mutation<
      ApiResponse<McqQuestion>,
      { questionId: string; data: Partial<McqQuestion> }
    >({
      query: ({ questionId, data }) => ({
        url: `/mcq/questions/${questionId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { questionId }) => [
        { type: 'McqQuestion', id: questionId },
        { type: 'McqQuestions', id: 'LIST' },
      ],
    }),

    deleteQuestion: builder.mutation<ApiResponse<null>, string>({
      query: (questionId) => ({
        url: `/mcq/questions/${questionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'McqQuestions', id: 'LIST' }],
    }),

    // ==================== MCQ Exams ====================
    getMcqExams: builder.query<
      ApiResponse<PaginatedResponse<McqExam>>,
      GetMcqExamsParams
    >({
      query: (params) => ({
        url: '/mcq/exams',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ examId }) => ({
                type: 'McqExam' as const,
                id: examId,
              })),
              { type: 'McqExams', id: 'LIST' },
            ]
          : [{ type: 'McqExams', id: 'LIST' }],
    }),

    getMcqExamById: builder.query<ApiResponse<McqExam>, string>({
      query: (examId) => `/mcq/exams/${examId}`,
      providesTags: (result, error, examId) => [{ type: 'McqExam', id: examId }],
    }),

    createMcqExam: builder.mutation<
      ApiResponse<McqExam>,
      {
        title: string;
        subjectId: string;
        classIds: string[];
        questionIds: string[];
        duration: number;
        startTime: string;
        endTime: string;
        shuffleQuestions?: boolean;
        shuffleOptions?: boolean;
        showResultImmediately?: boolean;
        allowRetake?: boolean;
        allowBackNavigation?: boolean;
      }
    >({
      query: (body) => ({
        url: '/mcq/exams',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'McqExams', id: 'LIST' }, 'Dashboard'],
    }),

    updateMcqExam: builder.mutation<
      ApiResponse<McqExam>,
      { examId: string; data: Partial<McqExam> }
    >({
      query: ({ examId, data }) => ({
        url: `/mcq/exams/${examId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { examId }) => [
        { type: 'McqExam', id: examId },
        { type: 'McqExams', id: 'LIST' },
      ],
    }),

    deleteMcqExam: builder.mutation<ApiResponse<null>, string>({
      query: (examId) => ({
        url: `/mcq/exams/${examId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'McqExams', id: 'LIST' }, 'Dashboard'],
    }),

    publishMcqExam: builder.mutation<ApiResponse<McqExam>, string>({
      query: (examId) => ({
        url: `/mcq/exams/${examId}/publish`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, examId) => [
        { type: 'McqExam', id: examId },
        { type: 'McqExams', id: 'LIST' },
        'Dashboard',
      ],
    }),

    // ==================== Student Exam Taking ====================
    // Get available exams for current student
    getAvailableMcqExams: builder.query<ApiResponse<McqExam[]>, void>({
      query: () => '/mcq/exams/available',
      providesTags: ['McqExams'],
    }),

    // Start exam attempt
    startMcqExam: builder.mutation<
      ApiResponse<{
        attempt: McqAttempt;
        questions: {
          questionId: string;
          questionText: string;
          options: string[];
        }[];
      }>,
      string
    >({
      query: (examId) => ({
        url: `/mcq/exams/${examId}/start`,
        method: 'POST',
      }),
    }),

    // Submit answer
    submitAnswer: builder.mutation<
      ApiResponse<null>,
      {
        attemptId: string;
        questionId: string;
        selectedOptionIndex: number;
      }
    >({
      query: ({ attemptId, ...body }) => ({
        url: `/mcq/attempts/${attemptId}/answer`,
        method: 'POST',
        body,
      }),
    }),

    // Submit exam
    submitMcqExam: builder.mutation<ApiResponse<McqAttempt>, string>({
      query: (attemptId) => ({
        url: `/mcq/attempts/${attemptId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: ['McqExams', 'Dashboard'],
    }),

    // Get attempt result
    getMcqAttemptResult: builder.query<
      ApiResponse<{
        attempt: McqAttempt;
        details?: {
          questionId: string;
          questionText: string;
          options: string[];
          selectedOptionIndex: number;
          correctOptionIndex: number;
          isCorrect: boolean;
        }[];
      }>,
      string
    >({
      query: (attemptId) => `/mcq/attempts/${attemptId}/result`,
    }),

    // ==================== Teacher/Admin Results View ====================
    getMcqExamResults: builder.query<
      ApiResponse<
        {
          studentId: string;
          studentName: string;
          className: string;
          sectionName: string;
          score: number;
          totalQuestions: number;
          percentage: number;
          submittedAt: string;
        }[]
      >,
      { examId: string; classId?: string; sectionId?: string }
    >({
      query: ({ examId, ...params }) => ({
        url: `/mcq/exams/${examId}/results`,
        params,
      }),
      providesTags: (result, error, { examId }) => [
        { type: 'McqExam', id: examId },
      ],
    }),

    getMcqQuestionAnalysis: builder.query<
      ApiResponse<
        {
          questionId: string;
          questionText: string;
          totalAttempts: number;
          correctAttempts: number;
          correctPercentage: number;
          optionDistribution: number[];
        }[]
      >,
      string
    >({
      query: (examId) => `/mcq/exams/${examId}/question-analysis`,
      providesTags: (result, error, examId) => [{ type: 'McqExam', id: examId }],
    }),
  }),
});

export const {
  // Questions
  useGetQuestionsQuery,
  useGetQuestionByIdQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  // MCQ Exams
  useGetMcqExamsQuery,
  useGetMcqExamByIdQuery,
  useCreateMcqExamMutation,
  useUpdateMcqExamMutation,
  useDeleteMcqExamMutation,
  usePublishMcqExamMutation,
  // Student Exam Taking
  useGetAvailableMcqExamsQuery,
  useStartMcqExamMutation,
  useSubmitAnswerMutation,
  useSubmitMcqExamMutation,
  useGetMcqAttemptResultQuery,
  // Results
  useGetMcqExamResultsQuery,
  useGetMcqQuestionAnalysisQuery,
} = mcqApi;
