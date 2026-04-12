import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  Teacher,
  CreateTeacherRequest,
  TimetableEntry,
  BulkImportResult,
  Student,
} from '../../types';

interface GetTeachersParams {
  page?: number;
  size?: number;
  search?: string;
  subjectId?: string;
  classId?: string;
}

export const teachersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all teachers
    getTeachers: builder.query<
      ApiResponse<PaginatedResponse<Teacher>>,
      GetTeachersParams
    >({
      query: (params) => ({
        url: '/teachers',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ teacherId }) => ({
                type: 'Teacher' as const,
                id: teacherId,
              })),
              { type: 'Teachers', id: 'LIST' },
            ]
          : [{ type: 'Teachers', id: 'LIST' }],
    }),

    // Get teacher by ID
    getTeacherById: builder.query<ApiResponse<Teacher>, string>({
      query: (teacherId) => `/teachers/${teacherId}`,
      providesTags: (result, error, teacherId) => [
        { type: 'Teacher', id: teacherId },
      ],
    }),

    // Create teacher
    createTeacher: builder.mutation<ApiResponse<Teacher>, CreateTeacherRequest>(
      {
        query: (body) => ({
          url: '/teachers',
          method: 'POST',
          body,
        }),
        invalidatesTags: [{ type: 'Teachers', id: 'LIST' }, 'Dashboard'],
      }
    ),

    // Update teacher
    updateTeacher: builder.mutation<
      ApiResponse<Teacher>,
      { teacherId: string; data: Partial<CreateTeacherRequest> }
    >({
      query: ({ teacherId, data }) => ({
        url: `/teachers/${teacherId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { teacherId }) => [
        { type: 'Teacher', id: teacherId },
        { type: 'Teachers', id: 'LIST' },
      ],
    }),

    // Delete teacher
    deleteTeacher: builder.mutation<ApiResponse<null>, string>({
      query: (teacherId) => ({
        url: `/teachers/${teacherId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Teachers', id: 'LIST' }, 'Dashboard'],
    }),

    // Get teacher's timetable
    getTeacherTimetable: builder.query<ApiResponse<TimetableEntry[]>, string>({
      query: (teacherId) => `/teachers/${teacherId}/timetable`,
      providesTags: ['Timetable'],
    }),

    // Get teacher's classes
    getTeacherClasses: builder.query<
      ApiResponse<{ classId: string; className: string; sectionId: string; sectionName: string }[]>,
      string
    >({
      query: (teacherId) => `/teachers/${teacherId}/classes`,
      providesTags: (result, error, teacherId) => [
        { type: 'Teacher', id: teacherId },
      ],
    }),

    // Get current teacher's assigned students
    getMyStudents: builder.query<
      ApiResponse<Student[]>,
      { classId?: string; sectionId?: string } | void
    >({
      query: (params) => ({
        url: '/teachers/me/students',
        params: params || {},
      }),
      providesTags: ['Students'],
    }),

    // Bulk import teachers
    bulkImportTeachers: builder.mutation<
      ApiResponse<BulkImportResult>,
      FormData
    >({
      query: (body) => ({
        url: '/teachers/bulk-import',
        method: 'POST',
        body,
        formData: true,
      }),
      invalidatesTags: [{ type: 'Teachers', id: 'LIST' }, 'Dashboard'],
    }),
  }),
});

export const {
  useGetTeachersQuery,
  useGetTeacherByIdQuery,
  useCreateTeacherMutation,
  useUpdateTeacherMutation,
  useDeleteTeacherMutation,
  useGetTeacherTimetableQuery,
  useGetTeacherClassesQuery,
  useGetMyStudentsQuery,
  useBulkImportTeachersMutation,
} = teachersApi;
