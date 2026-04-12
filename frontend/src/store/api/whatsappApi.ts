import { api } from './baseApi';
import {
  ApiResponse,
  WhatsAppMessage,
  WhatsAppRecipientInfo,
  SendWhatsAppRequest,
} from '../../types';

export const whatsappApi = api.injectEndpoints({
  endpoints: (builder) => ({
    sendWhatsAppMessage: builder.mutation<ApiResponse<WhatsAppMessage>, SendWhatsAppRequest>({
      query: (body) => ({ url: '/whatsapp/send', method: 'POST', body }),
      invalidatesTags: ['WhatsAppMessages'],
    }),
    getWhatsAppMessages: builder.query<
      ApiResponse<{ content: WhatsAppMessage[]; totalElements: number; totalPages: number; page: number; size: number }>,
      { page?: number; size?: number }
    >({
      query: (params) => ({ url: '/whatsapp/messages', params }),
      providesTags: ['WhatsAppMessages'],
    }),
    getWhatsAppMessageById: builder.query<ApiResponse<WhatsAppMessage>, string>({
      query: (id) => `/whatsapp/messages/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'WhatsAppMessage' as const, id }],
    }),
    resolveWhatsAppRecipients: builder.mutation<
      ApiResponse<WhatsAppRecipientInfo[]>,
      { recipientType: string; classId?: string; parentIds?: string[] }
    >({
      query: (body) => ({ url: '/whatsapp/resolve-recipients', method: 'POST', body }),
    }),
    uploadWhatsAppMedia: builder.mutation<
      ApiResponse<{ url: string; fileName: string; mimeType: string }>,
      FormData
    >({
      query: (body) => ({ url: '/whatsapp/upload-media', method: 'POST', body, formData: true }),
    }),
  }),
});

export const {
  useSendWhatsAppMessageMutation,
  useGetWhatsAppMessagesQuery,
  useGetWhatsAppMessageByIdQuery,
  useResolveWhatsAppRecipientsMutation,
  useUploadWhatsAppMediaMutation,
} = whatsappApi;
