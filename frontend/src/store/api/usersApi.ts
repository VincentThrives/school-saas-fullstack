import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  BulkImportResult,
} from '../../types';

interface GetUsersParams {
  page?: number;
  size?: number;
  role?: UserRole;
  status?: 'active' | 'inactive' | 'locked';
  search?: string;
  classId?: string;
  sectionId?: string;
}

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all users with pagination and filters
    getUsers: builder.query<ApiResponse<PaginatedResponse<User>>, GetUsersParams>({
      query: (params) => ({
        url: '/users',
        params,
      }),
      providesTags: (result) =>
        result?.data.content
          ? [
              ...result.data.content.map(({ userId }) => ({
                type: 'User' as const,
                id: userId,
              })),
              { type: 'Users', id: 'LIST' },
            ]
          : [{ type: 'Users', id: 'LIST' }],
    }),

    // Get user by ID
    getUserById: builder.query<ApiResponse<User>, string>({
      query: (userId) => `/users/${userId}`,
      providesTags: (result, error, userId) => [{ type: 'User', id: userId }],
    }),

    // Create user
    createUser: builder.mutation<ApiResponse<User>, CreateUserRequest>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }, 'Dashboard'],
    }),

    // Update user
    updateUser: builder.mutation<
      ApiResponse<User>,
      { userId: string; data: UpdateUserRequest }
    >({
      query: ({ userId, data }) => ({
        url: `/users/${userId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User', id: userId },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    // Update user status (activate/deactivate)
    updateUserStatus: builder.mutation<
      ApiResponse<User>,
      { userId: string; isActive: boolean }
    >({
      query: ({ userId, isActive }) => ({
        url: `/users/${userId}/status`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User', id: userId },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    // Unlock user account
    unlockUser: builder.mutation<ApiResponse<User>, string>({
      query: (userId) => ({
        url: `/users/${userId}/unlock`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, userId) => [
        { type: 'User', id: userId },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    // Delete user (soft delete)
    deleteUser: builder.mutation<ApiResponse<null>, string>({
      query: (userId) => ({
        url: `/users/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }, 'Dashboard'],
    }),

    // Reset user password
    resetUserPassword: builder.mutation<ApiResponse<null>, string>({
      query: (userId) => ({
        url: `/users/${userId}/reset-password`,
        method: 'POST',
      }),
    }),

    // Bulk import users
    bulkImportUsers: builder.mutation<ApiResponse<BulkImportResult>, FormData>({
      query: (body) => ({
        url: '/users/bulk-import',
        method: 'POST',
        body,
        formData: true,
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }, 'Dashboard'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUpdateUserStatusMutation,
  useUnlockUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  useBulkImportUsersMutation,
} = usersApi;
