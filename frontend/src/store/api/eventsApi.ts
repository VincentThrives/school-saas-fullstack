import { api } from './baseApi';
import { ApiResponse, SchoolEvent, EventType, UserRole } from '../../types';

interface GetEventsParams {
  startDate?: string;
  endDate?: string;
  type?: EventType;
  isHoliday?: boolean;
}

export const eventsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all events
    getEvents: builder.query<ApiResponse<SchoolEvent[]>, GetEventsParams>({
      query: (params) => ({
        url: '/events',
        params,
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ eventId }) => ({
                type: 'Event' as const,
                id: eventId,
              })),
              { type: 'Events', id: 'LIST' },
            ]
          : [{ type: 'Events', id: 'LIST' }],
    }),

    // Get event by ID
    getEventById: builder.query<ApiResponse<SchoolEvent>, string>({
      query: (eventId) => `/events/${eventId}`,
      providesTags: (result, error, eventId) => [{ type: 'Event', id: eventId }],
    }),

    // Create event
    createEvent: builder.mutation<
      ApiResponse<SchoolEvent>,
      {
        title: string;
        type: EventType;
        startDate: string;
        endDate: string;
        isHoliday?: boolean;
        isRecurring?: boolean;
        recurrencePattern?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
        visibleTo: ('ALL' | UserRole)[];
        description: string;
      }
    >({
      query: (body) => ({
        url: '/events',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Events', id: 'LIST' }, 'Dashboard'],
    }),

    // Update event
    updateEvent: builder.mutation<
      ApiResponse<SchoolEvent>,
      { eventId: string; data: Partial<SchoolEvent> }
    >({
      query: ({ eventId, data }) => ({
        url: `/events/${eventId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'Event', id: eventId },
        { type: 'Events', id: 'LIST' },
      ],
    }),

    // Delete event
    deleteEvent: builder.mutation<ApiResponse<null>, string>({
      query: (eventId) => ({
        url: `/events/${eventId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Events', id: 'LIST' }, 'Dashboard'],
    }),

    // Get holidays
    getHolidays: builder.query<
      ApiResponse<SchoolEvent[]>,
      { academicYearId?: string }
    >({
      query: (params) => ({
        url: '/events/holidays',
        params,
      }),
      providesTags: ['Events'],
    }),

    // Get calendar view data
    getCalendar: builder.query<
      ApiResponse<
        {
          date: string;
          events: {
            eventId: string;
            title: string;
            type: EventType;
            isHoliday: boolean;
          }[];
        }[]
      >,
      { month: number; year: number }
    >({
      query: (params) => ({
        url: '/events/calendar',
        params,
      }),
      providesTags: ['Events'],
    }),

    // Export calendar
    exportCalendar: builder.query<
      Blob,
      { format: 'pdf' | 'ical'; academicYearId?: string }
    >({
      query: (params) => ({
        url: '/events/export',
        params,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Get upcoming events
    getUpcomingEvents: builder.query<
      ApiResponse<SchoolEvent[]>,
      { days?: number }
    >({
      query: (params) => ({
        url: '/events/upcoming',
        params,
      }),
      providesTags: ['Events', 'Dashboard'],
    }),
  }),
});

export const {
  useGetEventsQuery,
  useGetEventByIdQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useGetHolidaysQuery,
  useGetCalendarQuery,
  useExportCalendarQuery,
  useGetUpcomingEventsQuery,
} = eventsApi;
