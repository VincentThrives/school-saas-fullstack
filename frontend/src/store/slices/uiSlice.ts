import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  isDarkMode: boolean;
  pageTitle: string;
  breadcrumbs: { label: string; path?: string }[];
  isLoading: boolean;
  loadingMessage: string;
  selectedAcademicYearId: string | null;
}

const initialState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  pageTitle: '',
  breadcrumbs: [],
  isLoading: false,
  loadingMessage: '',
  selectedAcademicYearId: localStorage.getItem('selectedAcademicYearId') || null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },

    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode;
      localStorage.setItem('darkMode', String(state.isDarkMode));
    },

    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload;
      localStorage.setItem('darkMode', String(action.payload));
    },

    setPageTitle: (state, action: PayloadAction<string>) => {
      state.pageTitle = action.payload;
    },

    setBreadcrumbs: (
      state,
      action: PayloadAction<{ label: string; path?: string }[]>
    ) => {
      state.breadcrumbs = action.payload;
    },

    setGlobalLoading: (
      state,
      action: PayloadAction<{ isLoading: boolean; message?: string }>
    ) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || '';
    },

    setSelectedAcademicYear: (state, action: PayloadAction<string | null>) => {
      state.selectedAcademicYearId = action.payload;
      if (action.payload) {
        localStorage.setItem('selectedAcademicYearId', action.payload);
      } else {
        localStorage.removeItem('selectedAcademicYearId');
      }
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  toggleDarkMode,
  setDarkMode,
  setPageTitle,
  setBreadcrumbs,
  setGlobalLoading,
  setSelectedAcademicYear,
} = uiSlice.actions;

// Selectors
export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen;
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.sidebarCollapsed;
export const selectIsDarkMode = (state: { ui: UIState }) => state.ui.isDarkMode;
export const selectPageTitle = (state: { ui: UIState }) => state.ui.pageTitle;
export const selectBreadcrumbs = (state: { ui: UIState }) => state.ui.breadcrumbs;
export const selectGlobalLoading = (state: { ui: UIState }) => ({
  isLoading: state.ui.isLoading,
  message: state.ui.loadingMessage,
});
export const selectSelectedAcademicYearId = (state: { ui: UIState }) => state.ui.selectedAcademicYearId;

export default uiSlice.reducer;
