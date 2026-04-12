import { api } from './baseApi';
import {
  ApiResponse,
  Class,
  Section,
  Subject,
  SubjectAssignment,
  AcademicYear,
  SubjectType,
} from '../../types';

export const classesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Academic Years ====================
    getAcademicYears: builder.query<ApiResponse<AcademicYear[]>, void>({
      query: () => '/academic-years',
      providesTags: ['AcademicYears'],
    }),

    getAcademicYearById: builder.query<ApiResponse<AcademicYear>, string>({
      query: (id) => `/academic-years/${id}`,
      providesTags: (result, error, id) => [{ type: 'AcademicYear', id }],
    }),

    createAcademicYear: builder.mutation<
      ApiResponse<AcademicYear>,
      { label: string; startDate: string; endDate: string }
    >({
      query: (body) => ({
        url: '/academic-years',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AcademicYears'],
    }),

    updateAcademicYear: builder.mutation<
      ApiResponse<AcademicYear>,
      { id: string; data: Partial<AcademicYear> }
    >({
      query: ({ id, data }) => ({
        url: `/academic-years/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'AcademicYear', id },
        'AcademicYears',
      ],
    }),

    setCurrentAcademicYear: builder.mutation<ApiResponse<AcademicYear>, string>({
      query: (id) => ({
        url: `/academic-years/${id}/set-current`,
        method: 'PATCH',
      }),
      invalidatesTags: ['AcademicYears'],
    }),

    archiveAcademicYear: builder.mutation<ApiResponse<AcademicYear>, string>({
      query: (id) => ({
        url: `/academic-years/${id}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: ['AcademicYears'],
    }),

    // ==================== Classes ====================
    getClasses: builder.query<
      ApiResponse<Class[]>,
      { academicYearId?: string } | void
    >({
      query: (params) => ({
        url: '/classes',
        params: params || {},
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ classId }) => ({
                type: 'Class' as const,
                id: classId,
              })),
              { type: 'Classes', id: 'LIST' },
            ]
          : [{ type: 'Classes', id: 'LIST' }],
    }),

    getClassById: builder.query<ApiResponse<Class>, string>({
      query: (classId) => `/classes/${classId}`,
      providesTags: (result, error, classId) => [{ type: 'Class', id: classId }],
    }),

    createClass: builder.mutation<
      ApiResponse<Class>,
      { name: string; grade: number; academicYearId: string }
    >({
      query: (body) => ({
        url: '/classes',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Classes', id: 'LIST' }, 'Dashboard'],
    }),

    updateClass: builder.mutation<
      ApiResponse<Class>,
      { classId: string; data: Partial<Class> }
    >({
      query: ({ classId, data }) => ({
        url: `/classes/${classId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { classId }) => [
        { type: 'Class', id: classId },
        { type: 'Classes', id: 'LIST' },
      ],
    }),

    deleteClass: builder.mutation<ApiResponse<null>, string>({
      query: (classId) => ({
        url: `/classes/${classId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Classes', id: 'LIST' }, 'Dashboard'],
    }),

    // ==================== Sections ====================
    getSections: builder.query<ApiResponse<Section[]>, string>({
      query: (classId) => `/classes/${classId}/sections`,
      providesTags: (result, error, classId) => [
        { type: 'Class', id: classId },
        'Section',
      ],
    }),

    createSection: builder.mutation<
      ApiResponse<Section>,
      {
        classId: string;
        name: string;
        capacity: number;
        classTeacherId?: string;
      }
    >({
      query: ({ classId, ...body }) => ({
        url: `/classes/${classId}/sections`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { classId }) => [
        { type: 'Class', id: classId },
        { type: 'Classes', id: 'LIST' },
      ],
    }),

    updateSection: builder.mutation<
      ApiResponse<Section>,
      {
        classId: string;
        sectionId: string;
        data: Partial<Section>;
      }
    >({
      query: ({ classId, sectionId, data }) => ({
        url: `/classes/${classId}/sections/${sectionId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { classId }) => [
        { type: 'Class', id: classId },
      ],
    }),

    deleteSection: builder.mutation<
      ApiResponse<null>,
      { classId: string; sectionId: string }
    >({
      query: ({ classId, sectionId }) => ({
        url: `/classes/${classId}/sections/${sectionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { classId }) => [
        { type: 'Class', id: classId },
        { type: 'Classes', id: 'LIST' },
      ],
    }),

    // ==================== Subjects ====================
    getSubjects: builder.query<
      ApiResponse<Subject[]>,
      { classId?: string } | void
    >({
      query: (params) => ({
        url: '/subjects',
        params: params || {},
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ subjectId }) => ({
                type: 'Subject' as const,
                id: subjectId,
              })),
              { type: 'Subjects', id: 'LIST' },
            ]
          : [{ type: 'Subjects', id: 'LIST' }],
    }),

    getSubjectById: builder.query<ApiResponse<Subject>, string>({
      query: (subjectId) => `/subjects/${subjectId}`,
      providesTags: (result, error, subjectId) => [
        { type: 'Subject', id: subjectId },
      ],
    }),

    createSubject: builder.mutation<
      ApiResponse<Subject>,
      { name: string; code: string; type: SubjectType; classIds: string[] }
    >({
      query: (body) => ({
        url: '/subjects',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Subjects', id: 'LIST' }],
    }),

    updateSubject: builder.mutation<
      ApiResponse<Subject>,
      { subjectId: string; data: Partial<Subject> }
    >({
      query: ({ subjectId, data }) => ({
        url: `/subjects/${subjectId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { subjectId }) => [
        { type: 'Subject', id: subjectId },
        { type: 'Subjects', id: 'LIST' },
      ],
    }),

    deleteSubject: builder.mutation<ApiResponse<null>, string>({
      query: (subjectId) => ({
        url: `/subjects/${subjectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Subjects', id: 'LIST' }],
    }),

    // ==================== Subject Assignments ====================
    getSubjectAssignments: builder.query<
      ApiResponse<SubjectAssignment[]>,
      { classId?: string; sectionId?: string; teacherId?: string } | void
    >({
      query: (params) => ({
        url: '/subject-assignments',
        params: params || {},
      }),
    }),

    assignSubjectToTeacher: builder.mutation<
      ApiResponse<SubjectAssignment>,
      {
        subjectId: string;
        classId: string;
        sectionId: string;
        teacherId: string;
      }
    >({
      query: (body) => ({
        url: '/subject-assignments',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Subjects', 'Teachers'],
    }),

    removeSubjectAssignment: builder.mutation<
      ApiResponse<null>,
      { subjectId: string; classId: string; sectionId: string }
    >({
      query: (params) => ({
        url: '/subject-assignments',
        method: 'DELETE',
        params,
      }),
      invalidatesTags: ['Subjects', 'Teachers'],
    }),
  }),
});

export const {
  // Academic Years
  useGetAcademicYearsQuery,
  useGetAcademicYearByIdQuery,
  useCreateAcademicYearMutation,
  useUpdateAcademicYearMutation,
  useSetCurrentAcademicYearMutation,
  useArchiveAcademicYearMutation,
  // Classes
  useGetClassesQuery,
  useGetClassByIdQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
  // Sections
  useGetSectionsQuery,
  useCreateSectionMutation,
  useUpdateSectionMutation,
  useDeleteSectionMutation,
  // Subjects
  useGetSubjectsQuery,
  useGetSubjectByIdQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
  // Subject Assignments
  useGetSubjectAssignmentsQuery,
  useAssignSubjectToTeacherMutation,
  useRemoveSubjectAssignmentMutation,
} = classesApi;
