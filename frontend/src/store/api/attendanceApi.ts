import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  Attendance,
  MarkAttendanceRequest,
  AttendanceSummary,
  BulkImportResult,
  AttendanceStatus,
} from '../../types';

interface GetAttendanceParams {
  page?: number;
  size?: number;
  studentId?: string;
  classId?: string;
  sectionId?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
}

export const attendanceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get attendance records
    getAttendance: builder.query<
      ApiResponse<PaginatedResponse<Attendance>>,
      GetAttendanceParams
    >({
      query: (params) => ({
        url: '/attendance',
        params,
      }),
      providesTags: ['Attendance'],
    }),

    // Get attendance for a specific date and class
    getAttendanceByDateAndClass: builder.query<
      ApiResponse<Attendance[]>,
      { classId: string; sectionId: string; date: string }
    >({
      query: (params) => ({
        url: '/attendance/by-date',
        params,
      }),
      providesTags: ['Attendance'],
    }),

    // Mark attendance (bulk for a class)
    markAttendance: builder.mutation<
      ApiResponse<Attendance[]>,
      MarkAttendanceRequest
    >({
      query: (body) => ({
        url: '/attendance/mark',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Attendance', 'Dashboard'],
    }),

    // Update single attendance record
    updateAttendance: builder.mutation<
      ApiResponse<Attendance>,
      {
        attendanceId: string;
        status: AttendanceStatus;
        remarks?: string;
      }
    >({
      query: ({ attendanceId, ...body }) => ({
        url: `/attendance/${attendanceId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Attendance'],
    }),

    // Get student attendance summary
    getStudentAttendanceSummary: builder.query<
      ApiResponse<AttendanceSummary>,
      { studentId: string; academicYearId?: string; month?: number; year?: number }
    >({
      query: ({ studentId, ...params }) => ({
        url: `/attendance/summary/student/${studentId}`,
        params,
      }),
      providesTags: (result, error, { studentId }) => [
        { type: 'Attendance', id: studentId },
      ],
    }),

    // Get class attendance summary
    getClassAttendanceSummary: builder.query<
      ApiResponse<{
        totalStudents: number;
        present: number;
        absent: number;
        late: number;
        halfDay: number;
        percentage: number;
      }>,
      { classId: string; sectionId?: string; date: string }
    >({
      query: ({ classId, ...params }) => ({
        url: `/attendance/summary/class/${classId}`,
        params,
      }),
      providesTags: ['Attendance'],
    }),

    // Bulk upload attendance
    bulkUploadAttendance: builder.mutation<
      ApiResponse<BulkImportResult>,
      FormData
    >({
      query: (body) => ({
        url: '/attendance/bulk-upload',
        method: 'POST',
        body,
        formData: true,
      }),
      invalidatesTags: ['Attendance', 'Dashboard'],
    }),

    // Get attendance report
    getAttendanceReport: builder.query<
      Blob,
      {
        classId?: string;
        sectionId?: string;
        startDate: string;
        endDate: string;
        format: 'pdf' | 'excel';
      }
    >({
      query: (params) => ({
        url: '/attendance/report',
        params,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Get students with low attendance
    getLowAttendanceStudents: builder.query<
      ApiResponse<
        {
          student: { studentId: string; firstName: string; lastName: string };
          percentage: number;
          className: string;
          sectionName: string;
        }[]
      >,
      { threshold?: number; classId?: string }
    >({
      query: (params) => ({
        url: '/attendance/low-attendance',
        params,
      }),
      providesTags: ['Attendance'],
    }),

    // Get attendance calendar for a student (month view)
    getStudentAttendanceCalendar: builder.query<
      ApiResponse<
        {
          date: string;
          status: AttendanceStatus;
        }[]
      >,
      { studentId: string; month: number; year: number }
    >({
      query: ({ studentId, ...params }) => ({
        url: `/attendance/calendar/student/${studentId}`,
        params,
      }),
      providesTags: (result, error, { studentId }) => [
        { type: 'Attendance', id: studentId },
      ],
    }),
  }),
});

export const {
  useGetAttendanceQuery,
  useGetAttendanceByDateAndClassQuery,
  useMarkAttendanceMutation,
  useUpdateAttendanceMutation,
  useGetStudentAttendanceSummaryQuery,
  useGetClassAttendanceSummaryQuery,
  useBulkUploadAttendanceMutation,
  useGetAttendanceReportQuery,
  useGetLowAttendanceStudentsQuery,
  useGetStudentAttendanceCalendarQuery,
} = attendanceApi;
