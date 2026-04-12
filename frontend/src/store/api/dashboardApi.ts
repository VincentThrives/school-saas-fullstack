import { api } from './baseApi';
import {
  ApiResponse,
  SuperAdminStats,
  SchoolAdminStats,
  PrincipalStats,
  TeacherStats,
  StudentStats,
  ParentStats,
  TimetableEntry,
  SchoolSettings,
} from '../../types';

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Dashboard Stats ====================
    getSuperAdminDashboard: builder.query<ApiResponse<SuperAdminStats>, void>({
      query: () => '/super/dashboard',
      providesTags: ['Dashboard'],
    }),

    getSchoolAdminDashboard: builder.query<ApiResponse<SchoolAdminStats>, void>({
      query: () => '/dashboard/school-admin',
      providesTags: ['Dashboard'],
    }),

    getPrincipalDashboard: builder.query<ApiResponse<PrincipalStats>, void>({
      query: () => '/dashboard/principal',
      providesTags: ['Dashboard'],
    }),

    getTeacherDashboard: builder.query<ApiResponse<TeacherStats>, void>({
      query: () => '/dashboard/teacher',
      providesTags: ['Dashboard'],
    }),

    getStudentDashboard: builder.query<ApiResponse<StudentStats>, void>({
      query: () => '/dashboard/student',
      providesTags: ['Dashboard'],
    }),

    getParentDashboard: builder.query<ApiResponse<ParentStats>, void>({
      query: () => '/dashboard/parent',
      providesTags: ['Dashboard'],
    }),

    // ==================== Timetable ====================
    getTimetable: builder.query<
      ApiResponse<TimetableEntry[]>,
      { classId: string; sectionId: string }
    >({
      query: (params) => ({
        url: '/timetable',
        params,
      }),
      providesTags: ['Timetable'],
    }),

    getMyTimetable: builder.query<ApiResponse<TimetableEntry[]>, void>({
      query: () => '/timetable/me',
      providesTags: ['Timetable'],
    }),

    getTodayTimetable: builder.query<ApiResponse<TimetableEntry[]>, void>({
      query: () => '/timetable/today',
      providesTags: ['Timetable'],
    }),

    createTimetableEntry: builder.mutation<
      ApiResponse<TimetableEntry>,
      {
        classId: string;
        sectionId: string;
        subjectId: string;
        teacherId: string;
        dayOfWeek: number;
        periodNumber: number;
        startTime: string;
        endTime: string;
        room?: string;
      }
    >({
      query: (body) => ({
        url: '/timetable',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Timetable'],
    }),

    updateTimetableEntry: builder.mutation<
      ApiResponse<TimetableEntry>,
      { entryId: string; data: Partial<TimetableEntry> }
    >({
      query: ({ entryId, data }) => ({
        url: `/timetable/${entryId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Timetable'],
    }),

    deleteTimetableEntry: builder.mutation<ApiResponse<null>, string>({
      query: (entryId) => ({
        url: `/timetable/${entryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Timetable'],
    }),

    bulkCreateTimetable: builder.mutation<
      ApiResponse<TimetableEntry[]>,
      {
        classId: string;
        sectionId: string;
        entries: Omit<TimetableEntry, 'entryId' | 'classId' | 'sectionId'>[];
      }
    >({
      query: (body) => ({
        url: '/timetable/bulk',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Timetable'],
    }),

    // ==================== Settings ====================
    getSettings: builder.query<ApiResponse<SchoolSettings>, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),

    updateSettings: builder.mutation<
      ApiResponse<SchoolSettings>,
      Partial<SchoolSettings>
    >({
      query: (body) => ({
        url: '/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Settings'],
    }),

    getValidationRules: builder.query<
      ApiResponse<{
        admissionNumberFormat: string;
        rollNumberFormat: string;
        employeeIdFormat: string;
        passwordPolicy: {
          minLength: number;
          requireUppercase: boolean;
          requireSpecialChar: boolean;
          expiryDays: number;
        };
      }>,
      void
    >({
      query: () => '/settings/validation-rules',
      providesTags: ['Settings'],
    }),

    updateValidationRules: builder.mutation<
      ApiResponse<SchoolSettings>,
      Partial<SchoolSettings>
    >({
      query: (body) => ({
        url: '/settings/validation-rules',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Settings'],
    }),
  }),
});

export const {
  // Dashboard
  useGetSuperAdminDashboardQuery,
  useGetSchoolAdminDashboardQuery,
  useGetPrincipalDashboardQuery,
  useGetTeacherDashboardQuery,
  useGetStudentDashboardQuery,
  useGetParentDashboardQuery,
  // Timetable
  useGetTimetableQuery,
  useGetMyTimetableQuery,
  useGetTodayTimetableQuery,
  useCreateTimetableEntryMutation,
  useUpdateTimetableEntryMutation,
  useDeleteTimetableEntryMutation,
  useBulkCreateTimetableMutation,
  // Settings
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useGetValidationRulesQuery,
  useUpdateValidationRulesMutation,
} = dashboardApi;
