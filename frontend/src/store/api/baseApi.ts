import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { logout, updateTokens } from '../slices/authSlice';
import { Mutex } from 'async-mutex';

// Base URL for API
const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Mutex to prevent multiple token refresh requests
const mutex = new Mutex();

// Base query with auth header
const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

// Base query with automatic token refresh
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Wait if another request is refreshing the token
  await mutex.waitForUnlock();

  let result = await baseQuery(args, api, extraOptions);

  // Handle 401 - Token expired
  if (result.error && result.error.status === 401) {
    // Check if we're already refreshing
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();

      try {
        const refreshToken = (api.getState() as RootState).auth.refreshToken;

        if (refreshToken) {
          // Try to refresh the token
          const refreshResult = await baseQuery(
            {
              url: '/auth/refresh',
              method: 'POST',
              body: { refreshToken },
            },
            api,
            extraOptions
          );

          if (refreshResult.data) {
            const data = refreshResult.data as {
              accessToken: string;
              refreshToken: string;
              featureFlags?: Record<string, boolean>;
            };

            // Update tokens in store
            api.dispatch(
              updateTokens({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                featureFlags: data.featureFlags,
              })
            );

            // Retry the original request
            result = await baseQuery(args, api, extraOptions);
          } else {
            // Refresh failed, logout
            api.dispatch(logout());
          }
        } else {
          // No refresh token, logout
          api.dispatch(logout());
        }
      } finally {
        release();
      }
    } else {
      // Another request is refreshing, wait and retry
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }

  return result;
};

// API tags for cache invalidation
export const apiTags = [
  'User',
  'Users',
  'Student',
  'Students',
  'Teacher',
  'Teachers',
  'Parent',
  'Parents',
  'Class',
  'Classes',
  'Section',
  'Subject',
  'Subjects',
  'AcademicYear',
  'AcademicYears',
  'Attendance',
  'Timetable',
  'Event',
  'Events',
  'Exam',
  'Exams',
  'McqQuestion',
  'McqQuestions',
  'McqExam',
  'McqExams',
  'McqAttempt',
  'Notification',
  'Notifications',
  'FeeStructure',
  'FeePayment',
  'FeePayments',
  'Settings',
  'MentoringNote',
  'MentoringNotes',
  'StudyMaterial',
  'StudyMaterials',
  'Message',
  'Messages',
  'Tenant',
  'Tenants',
  'AuditLog',
  'AuditLogs',
  'Dashboard',
] as const;

// Create the API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: apiTags,
  endpoints: () => ({}),
});

export default api;
