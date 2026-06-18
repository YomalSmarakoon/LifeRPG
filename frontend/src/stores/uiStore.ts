import { create } from 'zustand';

export type NavTab = 'dashboard' | 'quests' | 'progress' | 'achievements' | 'settings';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface LevelUpData {
  newLevel: number;
  newRank: string;
  statBoostMessage: string;
}

interface UiState {
  activeTab: NavTab;
  toasts: ToastMessage[];
  levelUpData: LevelUpData | null;
  theme: 'dark' | 'light';
  questBadgeCount: number;
}

interface UiActions {
  setActiveTab: (tab: NavTab) => void;
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
  showLevelUp: (data: LevelUpData) => void;
  dismissLevelUp: () => void;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setQuestBadgeCount: (count: number) => void;
}

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  activeTab: 'dashboard',
  toasts: [],
  levelUpData: null,
  theme: 'dark',
  questBadgeCount: 6,

  setActiveTab: (tab) => set({ activeTab: tab }),

  showToast: (message, variant = 'default') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => get().dismissToast(id), 2800);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  showLevelUp: (data) => set({ levelUpData: data }),
  dismissLevelUp: () => set({ levelUpData: null }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  setQuestBadgeCount: (count) => set({ questBadgeCount: count }),
}));
