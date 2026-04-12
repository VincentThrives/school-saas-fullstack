import { http, HttpResponse, delay } from 'msw';
import { mockUsers, mockTenants, generateMockToken, mockDashboardStats } from '../data/mockData';
import { UserRole } from '../../types';

const API_BASE = '/api/v1';

// Helper to create API response
const apiResponse = <T>(data: T, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

const apiError = (message: string, status = 400) =>
  HttpResponse.json(
    {
      success: false,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    },
    { status }
  );

export const authHandlers = [
  // Resolve tenant
  http.post(`${API_BASE}/auth/resolve-tenant`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { schoolId: string };

    const tenant = mockTenants.find(
      (t) => t.subdomain === body.schoolId || t.tenantId === body.schoolId || t.schoolName.toLowerCase().includes(body.schoolId.toLowerCase())
    );

    if (!tenant) {
      return apiError('School not found. Please check your School ID.', 404);
    }

    if (tenant.status === 'SUSPENDED') {
      return apiError('This school account is currently suspended. Contact your administrator.', 403);
    }

    if (tenant.status === 'INACTIVE') {
      return apiError('This school account is inactive.', 403);
    }

    return HttpResponse.json(
      apiResponse({
        tenantId: tenant.tenantId,
        schoolName: tenant.schoolName,
        logoUrl: tenant.logoUrl,
        status: tenant.status,
      })
    );
  }),

  // Tenant login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(800);
    const body = (await request.json()) as {
      tenantId: string;
      username: string;
      password: string;
    };

    // Find user by email/username
    const users = Object.values(mockUsers);
    const user = users.find(
      (u) =>
        (u.email === body.username || u.firstName.toLowerCase() === body.username.toLowerCase()) &&
        u.tenantId === body.tenantId &&
        u.role !== UserRole.SUPER_ADMIN
    );

    if (!user) {
      return apiError('Invalid credentials.', 401);
    }

    if (user.isLocked) {
      return apiError('Account locked due to multiple failed attempts. Contact your school admin.', 403);
    }

    const tenant = mockTenants.find((t) => t.tenantId === body.tenantId);

    return HttpResponse.json(
      apiResponse({
        accessToken: generateMockToken(user, body.tenantId),
        refreshToken: 'mock-refresh-token-' + Date.now(),
        user,
        role: user.role,
        featureFlags: tenant?.featureFlags || {},
      })
    );
  }),

  // Super admin login
  http.post(`${API_BASE}/super/auth/login`, async ({ request }) => {
    await delay(800);
    const body = (await request.json()) as {
      username: string;
      password: string;
    };

    // Only super admin can login here
    if (body.username !== 'admin' && body.username !== 'admin@schoolsaas.com') {
      return apiError('Invalid credentials.', 401);
    }

    const user = mockUsers.superAdmin;

    return HttpResponse.json(
      apiResponse({
        accessToken: generateMockToken(user),
        refreshToken: 'mock-refresh-token-super-' + Date.now(),
        user,
        role: user.role,
        featureFlags: {},
      })
    );
  }),

  // Refresh token
  http.post(`${API_BASE}/auth/refresh`, async () => {
    await delay(300);
    return HttpResponse.json(
      apiResponse({
        accessToken: 'mock-new-access-token-' + Date.now(),
        refreshToken: 'mock-new-refresh-token-' + Date.now(),
      })
    );
  }),

  // Logout
  http.post(`${API_BASE}/auth/logout`, async () => {
    await delay(200);
    return HttpResponse.json(apiResponse(null, 'Logged out successfully'));
  }),

  // Forgot password
  http.post(`${API_BASE}/auth/forgot-password`, async ({ request }) => {
    await delay(1000);
    const body = (await request.json()) as { email: string };

    // Always return success for security (don't reveal if email exists)
    return HttpResponse.json(
      apiResponse(null, `Password reset link sent to ${body.email}`)
    );
  }),

  // Change password
  http.post(`${API_BASE}/auth/change-password`, async () => {
    await delay(500);
    return HttpResponse.json(apiResponse(null, 'Password changed successfully'));
  }),

  // Get current user profile
  http.get(`${API_BASE}/users/me`, async () => {
    await delay(300);
    return HttpResponse.json(apiResponse(mockUsers.schoolAdmin));
  }),

  // Update profile
  http.put(`${API_BASE}/users/me`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      apiResponse({ ...mockUsers.schoolAdmin, ...body })
    );
  }),
];

export default authHandlers;
