import type {
  Character,
  DailyHabit,
  WeeklyHabit,
  XpEvent,
  AchievementDefinition,
  UserAchievement,
  HeatmapDay,
} from '../types';
import { levelFromTotalXp, currentLevelXpFromTotal, rankFromLevel, statsForLevel } from '../utils/xp-calculator';

const TODAY = '2026-06-18';
const WEEK_KEY = '2026-W25';

const TOTAL_XP = 2150;
const LEVEL = levelFromTotalXp(TOTAL_XP);

export const mockCharacter: Character = {
  level: LEVEL,
  totalXp: TOTAL_XP,
  currentLevelXp: currentLevelXpFromTotal(TOTAL_XP),
  xpToNextLevel: LEVEL * 500,
  rank: rankFromLevel(LEVEL),
  gold: 60,
  stats: statsForLevel(LEVEL) as unknown as Character['stats'],
  avatarEmoji: '⚔️',
  className: 'Software Engineer',
  streaks: {
    gym:       { current: 8,  shields: 1, lastDateKey: '2026-06-17' },
    code:      { current: 3,  shields: 0, lastDateKey: '2026-06-17' },
    reading:   { current: 0,  shields: 0, lastDateKey: null },
    earlyRise: { current: 14, shields: 2, lastDateKey: '2026-06-17' },
  },
};

export const mockDailyHabits: DailyHabit[] = [
  { id: 'h1', name: 'Gym Session',               icon: '🏋️', category: 'fitness', frequency: 'daily', xpReward: 50,  difficulty: 'medium', streakKey: 'gym',       isActive: true, sortOrder: 0, dateKey: TODAY, completedToday: true  },
  { id: 'h2', name: 'LeetCode Easy',              icon: '💻', category: 'coding',  frequency: 'daily', xpReward: 30,  difficulty: 'easy',   streakKey: 'code',      isActive: true, sortOrder: 1, dateKey: TODAY, completedToday: true  },
  { id: 'h3', name: 'LeetCode Medium',            icon: '💻', category: 'coding',  frequency: 'daily', xpReward: 60,  difficulty: 'medium', streakKey: 'code',      isActive: true, sortOrder: 2, dateKey: TODAY, completedToday: false },
  { id: 'h4', name: 'LeetCode Hard',              icon: '💻', category: 'coding',  frequency: 'daily', xpReward: 120, difficulty: 'hard',   streakKey: 'code',      isActive: true, sortOrder: 3, dateKey: TODAY, completedToday: false },
  { id: 'h5', name: 'Read 30 Min',                icon: '📚', category: 'reading', frequency: 'daily', xpReward: 25,  difficulty: 'easy',   streakKey: 'reading',   isActive: true, sortOrder: 4, dateKey: TODAY, completedToday: false },
  { id: 'h6', name: 'Study Java/Spring/Angular 1h', icon: '⚡', category: 'coding', frequency: 'daily', xpReward: 40,  difficulty: 'medium', streakKey: null,        isActive: true, sortOrder: 5, dateKey: TODAY, completedToday: true  },
  { id: 'h7', name: 'System Design 1h',           icon: '🏗️', category: 'coding',  frequency: 'daily', xpReward: 60,  difficulty: 'medium', streakKey: null,        isActive: true, sortOrder: 6, dateKey: TODAY, completedToday: false },
  { id: 'h8', name: 'Apply to Job',               icon: '💼', category: 'career',  frequency: 'daily', xpReward: 35,  difficulty: 'medium', streakKey: null,        isActive: true, sortOrder: 7, dateKey: TODAY, completedToday: false },
  { id: 'h9', name: 'Wake Up On Time',            icon: '⏰', category: 'wellness',frequency: 'daily', xpReward: 10,  difficulty: 'easy',   streakKey: 'earlyRise', isActive: true, sortOrder: 8, dateKey: TODAY, completedToday: true  },
  { id: 'h10', name: 'Plan Tomorrow',             icon: '📋', category: 'wellness',frequency: 'daily', xpReward: 10,  difficulty: 'easy',   streakKey: null,        isActive: true, sortOrder: 9, dateKey: TODAY, completedToday: false },
];

export const mockWeeklyHabits: WeeklyHabit[] = [
  { id: 'w1', name: '3 Gym Sessions',     icon: '🏋️', category: 'fitness', frequency: 'weekly', xpReward: 150, difficulty: 'medium', isActive: true, sortOrder: 0, weeklyTrackingMode: 'category_count', weeklyTarget: 3, weekKey: WEEK_KEY, progress: 3, completedThisWeek: true  },
  { id: 'w2', name: '5 LeetCodes',        icon: '💻', category: 'coding',  frequency: 'weekly', xpReward: 200, difficulty: 'hard',   isActive: true, sortOrder: 1, weeklyTrackingMode: 'habit_count',    weeklyTarget: 5, weekKey: WEEK_KEY, progress: 2, completedThisWeek: false },
  { id: 'w3', name: '3 Job Applications', icon: '💼', category: 'career',  frequency: 'weekly', xpReward: 105, difficulty: 'medium', isActive: true, sortOrder: 2, weeklyTrackingMode: 'category_count', weeklyTarget: 3, weekKey: WEEK_KEY, progress: 1, completedThisWeek: false },
  { id: 'w4', name: '1 Book Chapter',     icon: '📖', category: 'reading', frequency: 'weekly', xpReward: 50,  difficulty: 'easy',   isActive: true, sortOrder: 3, weeklyTrackingMode: 'category_count', weeklyTarget: 1, weekKey: WEEK_KEY, progress: 0, completedThisWeek: false },
  { id: 'w5', name: '1 Mock Interview',   icon: '🎤', category: 'career',  frequency: 'weekly', xpReward: 80,  difficulty: 'hard',   isActive: true, sortOrder: 4, weeklyTrackingMode: 'manual',         weeklyTarget: null, weekKey: WEEK_KEY, progress: 0, completedThisWeek: false },
];

export const mockAchievementDefinitions: AchievementDefinition[] = [
  { code: 'first_completion', name: 'First Blood',    icon: '⚔️',  description: 'Complete your first habit',         xpReward: 50,  category: 'general', condition: { type: 'totalHabitsCompleted_gte', threshold: 1  } },
  { code: 'complete_10',      name: 'Dedicated',      icon: '🌱',  description: 'Complete 10 habits',                xpReward: 75,  category: 'general', condition: { type: 'totalHabitsCompleted_gte', threshold: 10 } },
  { code: 'complete_50',      name: 'Committed',      icon: '🔥',  description: 'Complete 50 habits',                xpReward: 150, category: 'general', condition: { type: 'totalHabitsCompleted_gte', threshold: 50 } },
  { code: 'reach_level_5',    name: 'Apprentice',     icon: '⭐',  description: 'Reach Level 5',                     xpReward: 100, category: 'general', condition: { type: 'level_gte', threshold: 5  } },
  { code: 'reach_level_10',   name: 'Journeyman',     icon: '🌟',  description: 'Reach Level 10',                    xpReward: 200, category: 'general', condition: { type: 'level_gte', threshold: 10 } },
  { code: 'streak_3',         name: 'On a Roll',      icon: '🔥',  description: '3-day streak on any habit',         xpReward: 75,  category: 'general', condition: { type: 'anyStreakCurrent_gte', threshold: 3 } },
  { code: 'streak_7',         name: 'Week Warrior',   icon: '🗓️',  description: '7-day streak on any habit',         xpReward: 150, category: 'general', condition: { type: 'anyStreakCurrent_gte', threshold: 7 } },
];

export const mockUnlockedAchievements: UserAchievement[] = [
  { code: 'first_completion', unlockedAt: '2026-06-10T08:00:00Z', xpAwarded: 50  },
  { code: 'complete_10',      unlockedAt: '2026-06-12T09:30:00Z', xpAwarded: 75  },
  { code: 'streak_3',         unlockedAt: '2026-06-13T10:00:00Z', xpAwarded: 75  },
  { code: 'streak_7',         unlockedAt: '2026-06-17T08:45:00Z', xpAwarded: 150 },
];

export const mockXpEvents: XpEvent[] = [
  { id: 'xp1',  delta: 50,  source: 'habit_complete',     contextType: 'habit_logs', contextId: 'log1',  balanceBefore: 2100, balanceAfter: 2150, timestamp: '2026-06-18T07:30:00Z' },
  { id: 'xp2',  delta: 30,  source: 'habit_complete',     contextType: 'habit_logs', contextId: 'log2',  balanceBefore: 2070, balanceAfter: 2100, timestamp: '2026-06-18T07:15:00Z' },
  { id: 'xp3',  delta: 40,  source: 'habit_complete',     contextType: 'habit_logs', contextId: 'log3',  balanceBefore: 2030, balanceAfter: 2070, timestamp: '2026-06-18T07:00:00Z' },
  { id: 'xp4',  delta: 10,  source: 'habit_complete',     contextType: 'habit_logs', contextId: 'log4',  balanceBefore: 2020, balanceAfter: 2030, timestamp: '2026-06-18T06:30:00Z' },
  { id: 'xp5',  delta: 150, source: 'achievement_unlock', contextType: 'achievement_definitions', contextId: 'streak_7', balanceBefore: 1870, balanceAfter: 2020, timestamp: '2026-06-17T08:45:00Z' },
  { id: 'xp6',  delta: 50,  source: 'habit_complete',     contextType: 'habit_logs', contextId: 'log5',  balanceBefore: 1820, balanceAfter: 1870, timestamp: '2026-06-17T07:30:00Z' },
  { id: 'xp7',  delta: 60,  source: 'habit_complete',     contextType: 'habit_logs', contextId: 'log6',  balanceBefore: 1760, balanceAfter: 1820, timestamp: '2026-06-17T07:00:00Z' },
];

function buildHeatmap(): HeatmapDay[] {
  const today = new Date('2026-06-18');
  const days: HeatmapDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const completedCount = i === 0 ? 4 : i <= 5 ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 10);
    days.push({
      dateKey,
      completedCount,
      totalCount: 10,
      isFuture: false,
      isToday,
    });
  }
  return days;
}

export const mockHeatmapDays: HeatmapDay[] = buildHeatmap();

export const mockDashboard = {
  character: mockCharacter,
  todayHabits: mockDailyHabits,
  weeklyHabits: mockWeeklyHabits,
  xpToday: 130,
  completedTodayCount: 4,
  totalHabitsToday: 10,
  recentUnlockedAchievements: [
    { code: 'streak_7', name: 'Week Warrior', icon: '🗓️', unlockedAt: '2026-06-17T08:45:00Z' },
  ],
};
