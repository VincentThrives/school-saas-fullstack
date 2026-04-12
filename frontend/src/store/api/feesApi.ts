import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  FeeStructure,
  FeePayment,
  FeeStatus,
} from '../../types';

interface GetFeeStructuresParams {
  academicYearId?: string;
  classId?: string;
}

interface GetPaymentsParams {
  page?: number;
  size?: number;
  studentId?: string;
  classId?: string;
  startDate?: string;
  endDate?: string;
  paymentMode?: 'CASH' | 'CHEQUE' | 'ONLINE' | 'BANK_TRANSFER';
}

export const feesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Fee Structures ====================
    getFeeStructures: builder.query<
      ApiResponse<FeeStructure[]>,
      GetFeeStructuresParams
    >({
      query: (params) => ({
        url: '/fees/structures',
        params,
      }),
      providesTags: ['FeeStructure'],
    }),

    getFeeStructureById: builder.query<ApiResponse<FeeStructure>, string>({
      query: (id) => `/fees/structures/${id}`,
      providesTags: (result, error, id) => [{ type: 'FeeStructure', id }],
    }),

    createFeeStructure: builder.mutation<
      ApiResponse<FeeStructure>,
      {
        academicYearId: string;
        classId: string;
        feeType: string;
        amount: number;
        dueDate: string;
        description?: string;
      }
    >({
      query: (body) => ({
        url: '/fees/structures',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['FeeStructure'],
    }),

    updateFeeStructure: builder.mutation<
      ApiResponse<FeeStructure>,
      { id: string; data: Partial<FeeStructure> }
    >({
      query: ({ id, data }) => ({
        url: `/fees/structures/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['FeeStructure'],
    }),

    deleteFeeStructure: builder.mutation<ApiResponse<null>, string>({
      query: (id) => ({
        url: `/fees/structures/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FeeStructure'],
    }),

    // ==================== Fee Payments ====================
    getFeePayments: builder.query<
      ApiResponse<PaginatedResponse<FeePayment>>,
      GetPaymentsParams
    >({
      query: (params) => ({
        url: '/fees/payments',
        params,
      }),
      providesTags: ['FeePayments'],
    }),

    getFeePaymentById: builder.query<ApiResponse<FeePayment>, string>({
      query: (id) => `/fees/payments/${id}`,
      providesTags: (result, error, id) => [{ type: 'FeePayment', id }],
    }),

    recordFeePayment: builder.mutation<
      ApiResponse<FeePayment>,
      {
        studentId: string;
        feeStructureId: string;
        amountPaid: number;
        paymentDate: string;
        paymentMode: 'CASH' | 'CHEQUE' | 'ONLINE' | 'BANK_TRANSFER';
        remarks?: string;
      }
    >({
      query: (body) => ({
        url: '/fees/payments',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['FeePayments', 'Dashboard'],
    }),

    updateFeePayment: builder.mutation<
      ApiResponse<FeePayment>,
      { id: string; data: Partial<FeePayment> }
    >({
      query: ({ id, data }) => ({
        url: `/fees/payments/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['FeePayments'],
    }),

    deleteFeePayment: builder.mutation<ApiResponse<null>, string>({
      query: (id) => ({
        url: `/fees/payments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FeePayments', 'Dashboard'],
    }),

    // Get receipt as PDF
    downloadReceipt: builder.query<Blob, string>({
      query: (paymentId) => ({
        url: `/fees/payments/${paymentId}/receipt`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // ==================== Fee Status ====================
    getStudentFeeStatus: builder.query<
      ApiResponse<FeeStatus>,
      { studentId: string; academicYearId?: string }
    >({
      query: ({ studentId, ...params }) => ({
        url: `/fees/status/student/${studentId}`,
        params,
      }),
      providesTags: ['FeePayments'],
    }),

    getClassFeeStatus: builder.query<
      ApiResponse<
        {
          studentId: string;
          studentName: string;
          rollNumber: string;
          totalDue: number;
          totalPaid: number;
          outstanding: number;
        }[]
      >,
      { classId: string; sectionId?: string; academicYearId?: string }
    >({
      query: (params) => ({
        url: '/fees/status/class',
        params,
      }),
      providesTags: ['FeePayments'],
    }),

    // ==================== Reports ====================
    getFeeCollectionSummary: builder.query<
      ApiResponse<{
        totalDue: number;
        totalCollected: number;
        totalOutstanding: number;
        collectionRate: number;
        byPaymentMode: {
          mode: string;
          amount: number;
          count: number;
        }[];
        byClass: {
          classId: string;
          className: string;
          due: number;
          collected: number;
        }[];
      }>,
      { academicYearId?: string; month?: number; year?: number }
    >({
      query: (params) => ({
        url: '/fees/summary',
        params,
      }),
      providesTags: ['FeePayments', 'Dashboard'],
    }),

    getOverdueReport: builder.query<
      ApiResponse<
        {
          studentId: string;
          studentName: string;
          className: string;
          sectionName: string;
          feeType: string;
          amount: number;
          dueDate: string;
          daysOverdue: number;
        }[]
      >,
      { classId?: string }
    >({
      query: (params) => ({
        url: '/fees/overdue-report',
        params,
      }),
      providesTags: ['FeePayments'],
    }),

    exportFeeReport: builder.query<
      Blob,
      {
        classId?: string;
        academicYearId?: string;
        startDate?: string;
        endDate?: string;
        format: 'pdf' | 'excel';
      }
    >({
      query: (params) => ({
        url: '/fees/report/export',
        params,
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  // Fee Structures
  useGetFeeStructuresQuery,
  useGetFeeStructureByIdQuery,
  useCreateFeeStructureMutation,
  useUpdateFeeStructureMutation,
  useDeleteFeeStructureMutation,
  // Fee Payments
  useGetFeePaymentsQuery,
  useGetFeePaymentByIdQuery,
  useRecordFeePaymentMutation,
  useUpdateFeePaymentMutation,
  useDeleteFeePaymentMutation,
  useDownloadReceiptQuery,
  // Fee Status
  useGetStudentFeeStatusQuery,
  useGetClassFeeStatusQuery,
  // Reports
  useGetFeeCollectionSummaryQuery,
  useGetOverdueReportQuery,
  useExportFeeReportQuery,
} = feesApi;
