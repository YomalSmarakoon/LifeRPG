export interface StreakState {
  current: number;
  shields: number;
  lastDateKey?: string | null;
}

export interface CharacterStats {
  STR: number;
  INT: number;
  WIS: number;
  DEX: number;
  CHA: number;
  END: number;
}

export interface CharacterStreaks {
  gym: StreakState;
  code: StreakState;
  reading: StreakState;
  earlyRise: StreakState;
}

export interface Character {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  xpToNextLevel: number;
  rank: string;
  gold: number;
  stats: CharacterStats;
  avatarEmoji: string;
  className: string;
  streaks: CharacterStreaks;
  totalHabitsCompleted?: number;
  lastActiveDate?: string | null;
}

export interface User {
  userId: string;
  email: string;
  username: string;
  timezone: string;
  createdAt: string;
}

export type HabitFrequency = 'daily' | 'weekly';
export type HabitDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';
export type HabitCategory = 'fitness' | 'coding' | 'reading' | 'career' | 'wellness' | 'custom';
export type WeeklyTrackingMode = 'manual' | 'category_count' | 'habit_count';

export interface DailyHabit {
  id: string;
  name: string;
  icon: string;
  category: HabitCategory;
  frequency: 'daily';
  xpReward: number;
  difficulty: HabitDifficulty;
  streakKey: string | null;
  isActive: boolean;
  sortOrder: number;
  dateKey: string;
  completedToday: boolean;
}

export interface WeeklyHabit {
  id: string;
  name: string;
  icon: string;
  category: HabitCategory;
  frequency: 'weekly';
  xpReward: number;
  difficulty: HabitDifficulty;
  isActive: boolean;
  sortOrder: number;
  weeklyTrackingMode: WeeklyTrackingMode;
  weeklyTarget: number | null;
  weekKey: string;
  progress: number;
  completedThisWeek: boolean;
}

export type Habit = DailyHabit | WeeklyHabit;

export interface HabitLogSnapshot {
  name: string;
  category: HabitCategory;
  difficulty: HabitDifficulty;
  xpReward: number;
}

export interface HabitLog {
  id: string;
  logType: 'daily' | 'weekly_manual' | 'weekly_auto';
  dateKey: string;
  completedAt: string;
  xpAwarded: number;
  undone: boolean;
  habitSnapshot: HabitLogSnapshot;
}

export interface XpEvent {
  id: string;
  delta: number;
  source: 'habit_complete' | 'habit_undo' | 'achievement_unlock';
  contextType: string;
  contextId: string;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string;
}

export type AchievementConditionType =
  | 'totalHabitsCompleted_gte'
  | 'level_gte'
  | 'anyStreakCurrent_gte';

export interface AchievementCondition {
  type: AchievementConditionType;
  threshold: number;
}

export interface AchievementDefinition {
  code: string;
  name: string;
  icon: string;
  description: string;
  xpReward: number;
  category: string;
  condition: AchievementCondition;
}

export interface UserAchievement {
  code: string;
  unlockedAt: string;
  xpAwarded: number;
}

export interface AchievementsResponse {
  definitions: AchievementDefinition[];
  unlocked: UserAchievement[];
}

export interface RecentAchievement {
  code: string;
  name: string;
  icon: string;
  unlockedAt: string;
}

export interface DashboardResponse {
  character: Character;
  todayHabits: DailyHabit[];
  weeklyHabits: WeeklyHabit[];
  xpToday: number;
  completedTodayCount: number;
  totalHabitsToday: number;
  recentUnlockedAchievements: RecentAchievement[];
}

export interface HeatmapDay {
  dateKey: string;
  completedCount: number;
  totalCount: number;
  isFuture: boolean;
  isToday: boolean;
}

// ─── API response types (Phase 7) ───────────────────────────────────────────

export interface ApiAchievement {
  code: string;
  name: string;
  icon: string;
  description: string;
  xpReward: number;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
  xpAwarded: number | null;
}

export interface CompleteHabitResponse {
  habitLogId: string;
  xpAwarded: number;
  newTotalXp: number;
  previousLevel: number;
  newLevel: number;
  levelUp: boolean;
  newRank: string;
  streakUpdate: { streakKey: string; newCount: number; shieldEarned: boolean } | null;
  unlockedAchievements: { code: string; name: string; xpAwarded: number }[];
  weeklyAutoCompleted: { habitId: string; name: string; xpAwarded: number }[];
  alreadyProcessed?: boolean;
}

export interface UndoHabitResponse {
  xpReverted: number;
  newTotalXp: number;
  newLevel: number;
  newRank: string;
  weeklyAutoNote: string;
}

export interface ApiDashboardResponse {
  user: {
    id: string;
    email: string;
    username: string;
    timezone: string;
  };
  character: Character;
  habits: {
    daily: DailyHabit[];
    weekly: WeeklyHabit[];
  };
  achievements: {
    recentUnlocked: { code: string; name: string; icon: string; xpAwarded: number; unlockedAt: string }[];
    totalUnlocked: number;
    totalAvailable: number;
  };
  xp: {
    recentEvents: XpEvent[];
  };
  today: {
    dateKey: string;
    completedDailyCount: number;
    totalDailyCount: number;
  };
}
