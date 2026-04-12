import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, UserRole, FeatureKey } from '../../types';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  role: UserRole | null;
  accessToken: string | null;
  refreshToken: string | null;
  featureFlags: Record<FeatureKey, boolean>;
  isLoading: boolean;
  isSuperAdmin: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  role: null,
  accessToken: null,
  refreshToken: null,
  featureFlags: {} as Record<FeatureKey, boolean>,
  isLoading: true,
  isSuperAdmin: false,
};

// Helper to load state from localStorage
const loadFromStorage = (): Partial<AuthState> => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    const role = localStorage.getItem('role') as UserRole | null;
    const featureFlagsStr = localStorage.getItem('featureFlags');

    if (accessToken && userStr && role) {
      return {
        isAuthenticated: true,
        accessToken,
        refreshToken,
        user: JSON.parse(userStr),
        role,
        featureFlags: featureFlagsStr ? JSON.parse(featureFlagsStr) : {},
        isSuperAdmin: role === UserRole.SUPER_ADMIN,
        isLoading: false,
      };
    }
  } catch {
    // Invalid data in storage, clear it
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('featureFlags');
  }
  return { isLoading: false };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: { ...initialState, ...loadFromStorage() },
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: User;
        role: UserRole;
        accessToken: string;
        refreshToken: string;
        featureFlags: Record<FeatureKey, boolean>;
      }>
    ) => {
      const { user, role, accessToken, refreshToken, featureFlags } = action.payload;
      state.isAuthenticated = true;
      state.user = user;
      state.role = role;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.featureFlags = featureFlags;
      state.isSuperAdmin = role === UserRole.SUPER_ADMIN;
      state.isLoading = false;

      // Persist to localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('role', role);
      localStorage.setItem('featureFlags', JSON.stringify(featureFlags));
    },

    updateTokens: (
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        featureFlags?: Record<FeatureKey, boolean>;
      }>
    ) => {
      const { accessToken, refreshToken, featureFlags } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      if (featureFlags) {
        state.featureFlags = featureFlags;
        localStorage.setItem('featureFlags', JSON.stringify(featureFlags));
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    },

    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },

    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.role = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.featureFlags = {} as Record<FeatureKey, boolean>;
      state.isSuperAdmin = false;
      state.isLoading = false;

      // Clear localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      localStorage.removeItem('featureFlags');
      localStorage.removeItem('tenantId');
      localStorage.removeItem('schoolInfo');
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setCredentials, updateTokens, updateUser, logout, setLoading } = authSlice.actions;

// Selectors
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectRole = (state: { auth: AuthState }) => state.auth.role;
export const selectAccessToken = (state: { auth: AuthState }) => state.auth.accessToken;
export const selectFeatureFlags = (state: { auth: AuthState }) => state.auth.featureFlags;
export const selectIsSuperAdmin = (state: { auth: AuthState }) => state.auth.isSuperAdmin;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;

// Feature flag checker
export const selectHasFeature = (featureKey: FeatureKey) => (state: { auth: AuthState }) =>
  state.auth.featureFlags[featureKey] ?? false;

export default authSlice.reducer;
