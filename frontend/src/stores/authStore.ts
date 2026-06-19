import { create } from 'zustand';
import { authAxios } from '../lib/api-client';
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
  setAccessToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, timezone: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, token) =>
    set({ user, accessToken: token, isAuthenticated: true, isLoading: false }),

  clearAuth: () =>
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  setAccessToken: (token) => set({ accessToken: token }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authAxios.post<{
        accessToken: string;
        user: User;
      }>('/auth/login', { email, password });
      set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email, username, password, timezone) => {
    set({ isLoading: true });
    try {
      await authAxios.post('/auth/register', { email, username, password, timezone });
      // Registration doesn't return a token — auto-login immediately after
      const { data } = await authAxios.post<{
        accessToken: string;
        user: User;
      }>('/auth/login', { email, password });
      set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authAxios.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${get().accessToken ?? ''}` },
      });
    } catch {
      // Ignore server errors — always clear local state
    }
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  refresh: async () => {
    try {
      const { data } = await authAxios.post<{ accessToken: string }>('/auth/refresh');
      set({ accessToken: data.accessToken });

      // Fetch user profile with the new token
      const { data: user } = await authAxios.get<User>('/users/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },
}));
