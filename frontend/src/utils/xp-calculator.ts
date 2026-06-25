export function xpForLevel(level: number): number {
  return level * 500;
}

export function xpFloorForLevel(level: number): number {
  return (500 * level * (level - 1)) / 2;
}

export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  while (xpFloorForLevel(level + 1) <= totalXp) level++;
  return level;
}

export function currentLevelXpFromTotal(totalXp: number): number {
  return totalXp - xpFloorForLevel(levelFromTotalXp(totalXp));
}

const RANKS = [
  { name: 'Bronze', min: 1 },
  { name: 'Iron', min: 5 },
  { name: 'Silver', min: 10 },
  { name: 'Gold', min: 20 },
  { name: 'Platinum', min: 35 },
  { name: 'Diamond', min: 50 },
  { name: 'Legendary', min: 75 },
];

export function rankFromLevel(level: number): string {
  let rank = RANKS[0].name;
  for (const r of RANKS) {
    if (level >= r.min) rank = r.name;
  }
  return rank;
}

export function goldGainedFromLevels(levelBefore: number, levelAfter: number): number {
  let gold = 0;
  for (let lvl = levelBefore + 1; lvl <= levelAfter; lvl++) {
    gold += lvl * 10;
  }
  return gold;
}

export function statsForLevel(level: number): Record<string, number> {
  const keys = ['STR', 'INT', 'WIS', 'DEX', 'CHA', 'END'];
  const stats: Record<string, number> = { STR: 10, INT: 10, WIS: 10, DEX: 10, CHA: 10, END: 10 };
  for (let lvl = 2; lvl <= level; lvl++) {
    if (lvl % 5 === 0) {
      keys.forEach((k) => stats[k]++);
      keys.forEach((k) => stats[k]++);
    } else {
      stats[keys[lvl % keys.length]]++;
    }
  }
  return stats;
}

export function xpProgressPercent(currentLevelXp: number, xpToNextLevel: number): number {
  if (xpToNextLevel === 0) return 100;
  return Math.min(100, (currentLevelXp / xpToNextLevel) * 100);
}

export const RANK_STYLES: Record<string, string> = {
  Bronze: 'r-Bronze',
  Iron: 'r-Iron',
  Silver: 'r-Silver',
  Gold: 'r-Gold',
  Platinum: 'r-Platinum',
  Diamond: 'r-Diamond',
  Legendary: 'r-Legendary',
};

export const RANK_ICONS: Record<string, string> = {
  Bronze: '🥉',
  Iron: '⚙️',
  Silver: '🥈',
  Gold: '🥇',
  Platinum: '💎',
  Diamond: '💠',
  Legendary: '👑',
};

export const STAT_COLORS: Record<string, string> = {
  STR: '#ef4444',
  INT: '#3b82f6',
  WIS: '#8b5cf6',
  DEX: '#10b981',
  CHA: '#f59e0b',
  END: '#6366f1',
};

export const STAT_ICONS: Record<string, string> = {
  STR: '💪',
  INT: '🧠',
  WIS: '📚',
  DEX: '🏃',
  CHA: '💼',
  END: '🔒',
};
