import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { setupApiClient } from './lib/api-client';
import { BottomNav } from './components/layout/BottomNav';
import { ToastContainer } from './components/ui/Toast';
import { LevelUpOverlay } from './components/ui/LevelUpOverlay';
import { LoginScreen } from './features/auth/LoginScreen';
import { RegisterScreen } from './features/auth/RegisterScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { QuestsScreen } from './features/quests/QuestsScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { AchievementsScreen } from './features/achievements/AchievementsScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedApp() {
  return (
    <div className="app-shell">
      <LevelUpOverlay />
      <ToastContainer />
      <Routes>
        <Route path="/"             element={<DashboardScreen />} />
        <Route path="/quests"       element={<QuestsScreen />} />
        <Route path="/progress"     element={<ProgressScreen />} />
        <Route path="/achievements" element={<AchievementsScreen />} />
        <Route path="/settings"     element={<SettingsScreen />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginScreen />} />
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="*"         element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const refresh = useAuthStore((s) => s.refresh);

  // Wire api-client auth callbacks (no circular dep — reads state via getState)
  // Attempt refresh on every app boot to restore session from HttpOnly cookie
  useEffect(() => {
    setupApiClient(
      () => useAuthStore.getState().accessToken,
      () => useAuthStore.getState().clearAuth(),
      (token) => useAuthStore.getState().setAccessToken(token),
    );
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32 }}>⚔️</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {isAuthenticated ? <ProtectedApp /> : <AuthRoutes />}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
