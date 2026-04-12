import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  Tenant,
  TenantStatus,
  SubscriptionPlan,
  FeatureCatalog,
  FeatureKey,
  AuditLog,
} from '../../types';

interface GetTenantsParams {
  page?: number;
  size?: number;
  status?: TenantStatus;
  plan?: SubscriptionPlan;
  search?: string;
  country?: string;
}

interface GetAuditLogsParams {
  page?: number;
  size?: number;
  tenantId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export const superAdminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Tenant Management ====================
    getTenants: builder.query<
      ApiResponse<PaginatedResponse<Tenant>>,
      GetTenantsParams
    >({
      query: (params) => ({
        url: '/super/tenants',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ tenantId }) => ({
                type: 'Tenant' as const,
                id: tenantId,
              })),
              { type: 'Tenants', id: 'LIST' },
            ]
          : [{ type: 'Tenants', id: 'LIST' }],
    }),

    getTenantById: builder.query<ApiResponse<Tenant>, string>({
      query: (tenantId) => `/super/tenants/${tenantId}`,
      providesTags: (result, error, tenantId) => [
        { type: 'Tenant', id: tenantId },
      ],
    }),

    createTenant: builder.mutation<
      ApiResponse<Tenant>,
      {
        schoolName: string;
        subdomain: string;
        contactEmail: string;
        contactPhone: string;
        address: Tenant['address'];
        plan: SubscriptionPlan;
        adminEmail: string;
        adminPassword: string;
        adminFirstName: string;
        adminLastName: string;
      }
    >({
      query: (body) => ({
        url: '/super/tenants',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Tenants', id: 'LIST' }, 'Dashboard'],
    }),

    updateTenant: builder.mutation<
      ApiResponse<Tenant>,
      { tenantId: string; data: Partial<Tenant> }
    >({
      query: ({ tenantId, data }) => ({
        url: `/super/tenants/${tenantId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
        { type: 'Tenants', id: 'LIST' },
      ],
    }),

    updateTenantStatus: builder.mutation<
      ApiResponse<Tenant>,
      { tenantId: string; status: TenantStatus; reason?: string }
    >({
      query: ({ tenantId, ...body }) => ({
        url: `/super/tenants/${tenantId}/status`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
        { type: 'Tenants', id: 'LIST' },
        'Dashboard',
      ],
    }),

    deleteTenant: builder.mutation<ApiResponse<null>, string>({
      query: (tenantId) => ({
        url: `/super/tenants/${tenantId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Tenants', id: 'LIST' }, 'Dashboard'],
    }),

    // ==================== Feature Flags ====================
    getFeatureCatalog: builder.query<ApiResponse<FeatureCatalog[]>, void>({
      query: () => '/super/features/catalog',
    }),

    getTenantFeatures: builder.query<
      ApiResponse<Record<FeatureKey, boolean>>,
      string
    >({
      query: (tenantId) => `/super/tenants/${tenantId}/features`,
      providesTags: (result, error, tenantId) => [
        { type: 'Tenant', id: tenantId },
      ],
    }),

    enableFeature: builder.mutation<
      ApiResponse<null>,
      { tenantId: string; featureKey: FeatureKey }
    >({
      query: ({ tenantId, featureKey }) => ({
        url: `/super/tenants/${tenantId}/features/${featureKey}/enable`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
      ],
    }),

    disableFeature: builder.mutation<
      ApiResponse<null>,
      { tenantId: string; featureKey: FeatureKey }
    >({
      query: ({ tenantId, featureKey }) => ({
        url: `/super/tenants/${tenantId}/features/${featureKey}/disable`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
      ],
    }),

    bulkUpdateFeatures: builder.mutation<
      ApiResponse<null>,
      { tenantId: string; features: Record<FeatureKey, boolean> }
    >({
      query: ({ tenantId, features }) => ({
        url: `/super/tenants/${tenantId}/features`,
        method: 'PUT',
        body: { features },
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
      ],
    }),

    // ==================== Subscription Plans ====================
    updateTenantPlan: builder.mutation<
      ApiResponse<Tenant>,
      { tenantId: string; plan: SubscriptionPlan }
    >({
      query: ({ tenantId, plan }) => ({
        url: `/super/tenants/${tenantId}/plan`,
        method: 'PUT',
        body: { plan },
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
        { type: 'Tenants', id: 'LIST' },
      ],
    }),

    updateTenantLimits: builder.mutation<
      ApiResponse<Tenant>,
      {
        tenantId: string;
        limits: { maxStudents?: number; maxUsers?: number; storageGb?: number };
      }
    >({
      query: ({ tenantId, limits }) => ({
        url: `/super/tenants/${tenantId}/limits`,
        method: 'PATCH',
        body: limits,
      }),
      invalidatesTags: (result, error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
      ],
    }),

    // ==================== Stats & Monitoring ====================
    getGlobalStats: builder.query<
      ApiResponse<{
        totalTenants: number;
        activeTenants: number;
        inactiveTenants: number;
        suspendedTenants: number;
        totalUsers: number;
        totalStudents: number;
        totalTeachers: number;
        newTenantsThisMonth: number;
        totalStorageUsedGb: number;
        apiRequestsToday: number;
      }>,
      void
    >({
      query: () => '/super/tenants/stats',
      providesTags: ['Dashboard'],
    }),

    getTenantActivity: builder.query<
      ApiResponse<
        {
          tenantId: string;
          schoolName: string;
          lastLogin: string;
          lastDataWrite: string;
          activeUsers: number;
          storageUsedGb: number;
        }[]
      >,
      { sortBy?: 'lastLogin' | 'activeUsers' | 'storageUsed'; order?: 'asc' | 'desc' }
    >({
      query: (params) => ({
        url: '/super/tenants/activity',
        params,
      }),
    }),

    // ==================== Audit Logs ====================
    getGlobalAuditLogs: builder.query<
      ApiResponse<PaginatedResponse<AuditLog>>,
      GetAuditLogsParams
    >({
      query: (params) => ({
        url: '/super/audit-logs',
        params,
      }),
      providesTags: ['AuditLogs'],
    }),

    getFailedLogins: builder.query<
      ApiResponse<
        {
          tenantId: string;
          schoolName: string;
          email: string;
          ipAddress: string;
          timestamp: string;
          attempts: number;
        }[]
      >,
      { days?: number }
    >({
      query: (params) => ({
        url: '/super/audit-logs/failed-logins',
        params,
      }),
    }),

    // ==================== Global Configuration ====================
    getGlobalConfig: builder.query<
      ApiResponse<{
        corsAllowedOrigins: string[];
        rateLimitThresholds: Record<string, number>;
        jwtExpiryMinutes: number;
        maxFileUploadMb: number;
        allowedMimeTypes: string[];
        smtpConfig: {
          host: string;
          port: number;
          fromAddress: string;
        };
      }>,
      void
    >({
      query: () => '/super/config',
    }),

    updateGlobalConfig: builder.mutation<
      ApiResponse<null>,
      {
        corsAllowedOrigins?: string[];
        rateLimitThresholds?: Record<string, number>;
        jwtExpiryMinutes?: number;
        maxFileUploadMb?: number;
        allowedMimeTypes?: string[];
      }
    >({
      query: (body) => ({
        url: '/super/config',
        method: 'PUT',
        body,
      }),
    }),
  }),
});

export const {
  // Tenant Management
  useGetTenantsQuery,
  useGetTenantByIdQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useUpdateTenantStatusMutation,
  useDeleteTenantMutation,
  // Feature Flags
  useGetFeatureCatalogQuery,
  useGetTenantFeaturesQuery,
  useEnableFeatureMutation,
  useDisableFeatureMutation,
  useBulkUpdateFeaturesMutation,
  // Subscription Plans
  useUpdateTenantPlanMutation,
  useUpdateTenantLimitsMutation,
  // Stats & Monitoring
  useGetGlobalStatsQuery,
  useGetTenantActivityQuery,
  // Audit Logs
  useGetGlobalAuditLogsQuery,
  useGetFailedLoginsQuery,
  // Global Configuration
  useGetGlobalConfigQuery,
  useUpdateGlobalConfigMutation,
} = superAdminApi;
