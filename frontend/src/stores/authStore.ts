import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

const MOCK_USER: User = {
  userId: 'mock-user-001',
  email: 'yomal@example.com',
  username: 'TheArchitect',
  timezone: 'Asia/Colombo',
  createdAt: '2026-06-10T00:00:00Z',
};

// Phase 1: mock authenticated state so all screens are visible.
// Phase 3 (Auth) will replace this with real JWT logic.
export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: MOCK_USER,
  accessToken: 'mock-token',
  isAuthenticated: true,
  isLoading: false,

  setAuth: (user, token) =>
    set({ user, accessToken: token, isAuthenticated: true, isLoading: false }),

  clearAuth: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),

  setLoading: (loading) => set({ isLoading: loading }),
}));
