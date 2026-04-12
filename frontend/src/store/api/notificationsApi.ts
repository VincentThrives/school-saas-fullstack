import { api } from './baseApi';
import {
  ApiResponse,
  PaginatedResponse,
  Notification,
  NotificationType,
  NotificationChannel,
  UserRole,
  Message,
  StudyMaterial,
} from '../../types';

interface GetNotificationsParams {
  page?: number;
  size?: number;
  type?: NotificationType;
  unreadOnly?: boolean;
}

interface GetMessagesParams {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Notifications ====================
    getNotifications: builder.query<
      ApiResponse<PaginatedResponse<Notification>>,
      GetNotificationsParams
    >({
      query: (params) => ({
        url: '/notifications',
        params,
      }),
      providesTags: ['Notifications'],
    }),

    getUnreadCount: builder.query<ApiResponse<{ count: number }>, void>({
      query: () => '/notifications/unread-count',
      providesTags: ['Notifications'],
    }),

    markAsRead: builder.mutation<ApiResponse<null>, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Notifications'],
    }),

    markAllAsRead: builder.mutation<ApiResponse<null>, void>({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PATCH',
      }),
      invalidatesTags: ['Notifications'],
    }),

    sendNotification: builder.mutation<
      ApiResponse<Notification>,
      {
        title: string;
        body: string;
        type: NotificationType;
        channel: NotificationChannel;
        recipientType: 'ALL' | 'ROLE' | 'CLASS' | 'INDIVIDUAL';
        recipientRole?: UserRole;
        recipientClassId?: string;
        recipientIds?: string[];
      }
    >({
      query: (body) => ({
        url: '/notifications',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Notifications'],
    }),

    // ==================== Announcements ====================
    getAnnouncements: builder.query<
      ApiResponse<Notification[]>,
      { limit?: number }
    >({
      query: (params) => ({
        url: '/notifications/announcements',
        params,
      }),
      providesTags: ['Notifications'],
    }),

    createAnnouncement: builder.mutation<
      ApiResponse<Notification>,
      {
        title: string;
        body: string;
        visibleTo: ('ALL' | UserRole)[];
        attachmentUrl?: string;
      }
    >({
      query: (body) => ({
        url: '/notifications/announcements',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Notifications', 'Dashboard'],
    }),

    // ==================== Messages ====================
    getMessages: builder.query<
      ApiResponse<PaginatedResponse<Message>>,
      GetMessagesParams
    >({
      query: (params) => ({
        url: '/messages',
        params,
      }),
      providesTags: ['Messages'],
    }),

    getMessage: builder.query<ApiResponse<Message>, string>({
      query: (messageId) => `/messages/${messageId}`,
      providesTags: (result, error, id) => [{ type: 'Message', id }],
    }),

    sendMessage: builder.mutation<
      ApiResponse<Message>,
      {
        receiverId: string;
        subject: string;
        body: string;
      }
    >({
      query: (body) => ({
        url: '/messages',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Messages'],
    }),

    markMessageAsRead: builder.mutation<ApiResponse<null>, string>({
      query: (messageId) => ({
        url: `/messages/${messageId}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Messages'],
    }),

    getUnreadMessagesCount: builder.query<ApiResponse<{ count: number }>, void>({
      query: () => '/messages/unread-count',
      providesTags: ['Messages'],
    }),

    // ==================== Study Materials ====================
    getStudyMaterials: builder.query<
      ApiResponse<StudyMaterial[]>,
      { classId?: string; subjectId?: string }
    >({
      query: (params) => ({
        url: '/study-materials',
        params,
      }),
      providesTags: ['StudyMaterials'],
    }),

    getStudyMaterialById: builder.query<ApiResponse<StudyMaterial>, string>({
      query: (id) => `/study-materials/${id}`,
      providesTags: (result, error, id) => [{ type: 'StudyMaterial', id }],
    }),

    uploadStudyMaterial: builder.mutation<
      ApiResponse<StudyMaterial>,
      FormData
    >({
      query: (body) => ({
        url: '/study-materials',
        method: 'POST',
        body,
        formData: true,
      }),
      invalidatesTags: ['StudyMaterials'],
    }),

    updateStudyMaterial: builder.mutation<
      ApiResponse<StudyMaterial>,
      { id: string; data: { title?: string; description?: string } }
    >({
      query: ({ id, data }) => ({
        url: `/study-materials/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['StudyMaterials'],
    }),

    deleteStudyMaterial: builder.mutation<ApiResponse<null>, string>({
      query: (id) => ({
        url: `/study-materials/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['StudyMaterials'],
    }),

    downloadStudyMaterial: builder.query<Blob, string>({
      query: (id) => ({
        url: `/study-materials/${id}/download`,
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  // Notifications
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useSendNotificationMutation,
  // Announcements
  useGetAnnouncementsQuery,
  useCreateAnnouncementMutation,
  // Messages
  useGetMessagesQuery,
  useGetMessageQuery,
  useSendMessageMutation,
  useMarkMessageAsReadMutation,
  useGetUnreadMessagesCountQuery,
  // Study Materials
  useGetStudyMaterialsQuery,
  useGetStudyMaterialByIdQuery,
  useUploadStudyMaterialMutation,
  useUpdateStudyMaterialMutation,
  useDeleteStudyMaterialMutation,
  useDownloadStudyMaterialQuery,
} = notificationsApi;
