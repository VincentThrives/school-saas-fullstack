import { api } from './baseApi';
import {
  ApiResponse,
  ResolveTenantRequest,
  ResolveTenantResponse,
  LoginRequest,
  SuperAdminLoginRequest,
  AuthResponse,
  User,
} from '../../types';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Resolve tenant by school ID
    resolveTenant: builder.mutation<
      ApiResponse<ResolveTenantResponse>,
      ResolveTenantRequest
    >({
      query: (body) => ({
        url: '/auth/resolve-tenant',
        method: 'POST',
        body,
      }),
    }),

    // Tenant user login
    login: builder.mutation<ApiResponse<AuthResponse>, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dashboard'],
    }),

    // Super admin login
    superAdminLogin: builder.mutation<
      ApiResponse<AuthResponse>,
      SuperAdminLoginRequest
    >({
      query: (body) => ({
        url: '/super/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dashboard', 'Tenants'],
    }),

    // Refresh token
    refreshToken: builder.mutation<
      ApiResponse<{ accessToken: string; refreshToken: string }>,
      { refreshToken: string }
    >({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body,
      }),
    }),

    // Logout
    logout: builder.mutation<ApiResponse<null>, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),

    // Forgot password
    forgotPassword: builder.mutation<ApiResponse<null>, { email: string }>({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body,
      }),
    }),

    // Reset password
    resetPassword: builder.mutation<
      ApiResponse<null>,
      { token: string; newPassword: string }
    >({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body,
      }),
    }),

    // Change password
    changePassword: builder.mutation<
      ApiResponse<null>,
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        body,
      }),
    }),

    // Get current user profile
    getProfile: builder.query<ApiResponse<User>, void>({
      query: () => '/users/me',
      providesTags: ['User'],
    }),

    // Update profile
    updateProfile: builder.mutation<
      ApiResponse<User>,
      { firstName?: string; lastName?: string; phone?: string }
    >({
      query: (body) => ({
        url: '/users/me',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    // Upload profile photo
    uploadProfilePhoto: builder.mutation<
      ApiResponse<{ photoUrl: string }>,
      FormData
    >({
      query: (body) => ({
        url: '/users/me/photo',
        method: 'POST',
        body,
        formData: true,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useResolveTenantMutation,
  useLoginMutation,
  useSuperAdminLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUploadProfilePhotoMutation,
} = authApi;
