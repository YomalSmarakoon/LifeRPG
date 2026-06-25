import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001/api/v1';

// Auth axios — no interceptors; used for login, register, refresh, logout
export const authAxios = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Main API client — carries access token, handles 401 → refresh → retry
export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Auth callbacks — registered from App.tsx to avoid circular dependency with authStore
type TokenGetter = () => string | null;
type AuthClearer = () => void;
type TokenSetter = (token: string) => void;

let getAccessToken: TokenGetter = () => null;
let clearAuthState: AuthClearer = () => {};
let setNewToken: TokenSetter = () => {};

export function setupApiClient(
  getToken: TokenGetter,
  clearAuth: AuthClearer,
  setToken: TokenSetter,
): void {
  getAccessToken = getToken;
  clearAuthState = clearAuth;
  setNewToken = setToken;
}

// Attach Bearer token to every request
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: attempt one refresh, retry, then clear auth on failure
let isRefreshing = false;
const refreshWaiters: Array<(token: string | null) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (err: unknown) => {
    const error = err as import('axios').AxiosError;
    const original = error.config as import('axios').InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshWaiters.push((token) => {
          if (token) {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          } else {
            reject(err);
          }
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await authAxios.post<{ accessToken: string }>('/auth/refresh');
      setNewToken(data.accessToken);
      refreshWaiters.forEach((cb) => cb(data.accessToken));
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch {
      clearAuthState();
      refreshWaiters.forEach((cb) => cb(null));
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
      refreshWaiters.length = 0;
    }
  },
);
