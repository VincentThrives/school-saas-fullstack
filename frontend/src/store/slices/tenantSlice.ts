import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TenantStatus } from '../../types';

interface SchoolInfo {
  tenantId: string;
  schoolName: string;
  logoUrl: string;
  status: TenantStatus;
}

interface TenantState {
  schoolInfo: SchoolInfo | null;
  isResolved: boolean;
  isResolving: boolean;
  error: string | null;
}

// Try to load from localStorage (for session persistence)
const loadFromStorage = (): Partial<TenantState> => {
  try {
    const schoolInfoStr = localStorage.getItem('schoolInfo');
    const tenantId = localStorage.getItem('tenantId');
    if (schoolInfoStr && tenantId) {
      return {
        schoolInfo: JSON.parse(schoolInfoStr),
        isResolved: true,
      };
    }
  } catch {
    localStorage.removeItem('schoolInfo');
    localStorage.removeItem('tenantId');
  }
  return {};
};

const initialState: TenantState = {
  schoolInfo: null,
  isResolved: false,
  isResolving: false,
  error: null,
  ...loadFromStorage(),
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setResolving: (state, action: PayloadAction<boolean>) => {
      state.isResolving = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    setSchoolInfo: (state, action: PayloadAction<SchoolInfo>) => {
      state.schoolInfo = action.payload;
      state.isResolved = true;
      state.isResolving = false;
      state.error = null;

      // Persist to localStorage
      localStorage.setItem('schoolInfo', JSON.stringify(action.payload));
      localStorage.setItem('tenantId', action.payload.tenantId);
    },

    setTenantError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isResolving = false;
    },

    clearTenant: (state) => {
      state.schoolInfo = null;
      state.isResolved = false;
      state.isResolving = false;
      state.error = null;

      localStorage.removeItem('schoolInfo');
      localStorage.removeItem('tenantId');
    },
  },
});

export const { setResolving, setSchoolInfo, setTenantError, clearTenant } =
  tenantSlice.actions;

// Selectors
export const selectSchoolInfo = (state: { tenant: TenantState }) =>
  state.tenant.schoolInfo;
export const selectTenantId = (state: { tenant: TenantState }) =>
  state.tenant.schoolInfo?.tenantId || null;
export const selectIsTenantResolved = (state: { tenant: TenantState }) =>
  state.tenant.isResolved;
export const selectIsTenantResolving = (state: { tenant: TenantState }) =>
  state.tenant.isResolving;
export const selectTenantError = (state: { tenant: TenantState }) =>
  state.tenant.error;

export default tenantSlice.reducer;
