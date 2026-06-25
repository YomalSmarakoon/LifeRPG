import type { HabitCategory, HabitDifficulty, WeeklyTrackingMode } from '../schemas/habit.schema';

export interface DailyHabitSeed {
  name: string;
  icon: string;
  category: HabitCategory;
  frequency: 'daily';
  xpReward: number;
  difficulty: HabitDifficulty;
  streakKey: string | null;
  sortOrder: number;
}

export interface WeeklyHabitSeed {
  name: string;
  icon: string;
  category: HabitCategory;
  frequency: 'weekly';
  xpReward: number;
  difficulty: HabitDifficulty;
  weeklyTrackingMode: WeeklyTrackingMode;
  weeklyTarget: number | null;
  weeklyCategory: string | null;
  // References daily seeds by index (0-based) in DAILY_HABITS array
  weeklyHabitIndices: number[];
  sortOrder: number;
}

export const DAILY_HABITS: DailyHabitSeed[] = [
  { name: 'Gym Session',                icon: '🏋️', category: 'fitness', frequency: 'daily', xpReward: 50,  difficulty: 'medium', streakKey: 'gym',       sortOrder: 0 },
  { name: 'LeetCode Easy',              icon: '💻', category: 'coding',  frequency: 'daily', xpReward: 30,  difficulty: 'easy',   streakKey: 'code',      sortOrder: 1 },
  { name: 'LeetCode Medium',            icon: '💻', category: 'coding',  frequency: 'daily', xpReward: 60,  difficulty: 'medium', streakKey: 'code',      sortOrder: 2 },
  { name: 'LeetCode Hard',              icon: '💻', category: 'coding',  frequency: 'daily', xpReward: 120, difficulty: 'hard',   streakKey: 'code',      sortOrder: 3 },
  { name: 'Read 30 Min',                icon: '📚', category: 'reading', frequency: 'daily', xpReward: 25,  difficulty: 'easy',   streakKey: 'reading',   sortOrder: 4 },
  { name: 'Study Java/Spring/Angular 1h', icon: '⚡', category: 'coding', frequency: 'daily', xpReward: 40,  difficulty: 'medium', streakKey: null,        sortOrder: 5 },
  { name: 'System Design 1h',           icon: '🏗️', category: 'coding',  frequency: 'daily', xpReward: 60,  difficulty: 'hard',   streakKey: null,        sortOrder: 6 },
  { name: 'Apply to Job',               icon: '💼', category: 'career',  frequency: 'daily', xpReward: 35,  difficulty: 'medium', streakKey: null,        sortOrder: 7 },
  { name: 'Wake Up On Time',            icon: '⏰', category: 'wellness',frequency: 'daily', xpReward: 10,  difficulty: 'easy',   streakKey: 'earlyRise', sortOrder: 8 },
  { name: 'Plan Tomorrow',              icon: '📋', category: 'wellness',frequency: 'daily', xpReward: 10,  difficulty: 'easy',   streakKey: null,        sortOrder: 9 },
];

// weeklyHabitIndices: indexes into DAILY_HABITS for habit_count mode
// [1,2,3] = LeetCode Easy, LeetCode Medium, LeetCode Hard
export const WEEKLY_HABITS: WeeklyHabitSeed[] = [
  {
    name: '3 Gym Sessions',     icon: '🏋️', category: 'fitness', frequency: 'weekly', xpReward: 150, difficulty: 'medium',
    weeklyTrackingMode: 'category_count', weeklyTarget: 3, weeklyCategory: 'fitness', weeklyHabitIndices: [],
    sortOrder: 0,
  },
  {
    name: '5 LeetCodes',        icon: '💻', category: 'coding',  frequency: 'weekly', xpReward: 200, difficulty: 'hard',
    weeklyTrackingMode: 'habit_count',    weeklyTarget: 5, weeklyCategory: null,     weeklyHabitIndices: [1, 2, 3],
    sortOrder: 1,
  },
  {
    name: '3 Job Applications', icon: '💼', category: 'career',  frequency: 'weekly', xpReward: 105, difficulty: 'medium',
    weeklyTrackingMode: 'category_count', weeklyTarget: 3, weeklyCategory: 'career', weeklyHabitIndices: [],
    sortOrder: 2,
  },
  {
    name: '1 Book Chapter',     icon: '📖', category: 'reading', frequency: 'weekly', xpReward: 50,  difficulty: 'medium',
    weeklyTrackingMode: 'category_count', weeklyTarget: 1, weeklyCategory: 'reading', weeklyHabitIndices: [],
    sortOrder: 3,
  },
  {
    name: '1 Mock Interview',   icon: '🎤', category: 'career',  frequency: 'weekly', xpReward: 80,  difficulty: 'hard',
    weeklyTrackingMode: 'manual',         weeklyTarget: null, weeklyCategory: null,  weeklyHabitIndices: [],
    sortOrder: 4,
  },
];
