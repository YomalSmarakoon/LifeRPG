import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CharactersService } from '../characters/characters.service';
import { HabitsService } from '../habits/habits.service';
import { AchievementsService } from '../achievements/achievements.service';
import { XpService } from '../xp/xp.service';
import { toDateKey } from '../common/utils/date.utils';

@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly charactersService: CharactersService,
    private readonly habitsService: HabitsService,
    private readonly achievementsService: AchievementsService,
    private readonly xpService: XpService,
  ) {}

  async getDashboard(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const [character, habitsResult, achievements, xpData] = await Promise.all([
      this.charactersService.getCharacterForUser(userId),
      this.habitsService.listHabits(userId, undefined, true),
      this.achievementsService.findAllWithStatus(userId),
      this.xpService.listEvents(userId, 10),
    ]);

    const { habits } = habitsResult;
    const dailyHabits = habits.filter((h) => h.frequency === 'daily');
    const weeklyHabits = habits.filter((h) => h.frequency === 'weekly');
    const completedDailyCount = dailyHabits.filter((h) => h.completedToday).length;

    const unlockedAchs = achievements.filter((a) => a.unlocked);
    const recentUnlocked = unlockedAchs
      .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
      .slice(0, 5)
      .map((a) => ({
        code: a.code,
        name: a.name,
        icon: a.icon,
        xpAwarded: a.xpAwarded!,
        unlockedAt: a.unlockedAt!,
      }));

    const userSafe = this.usersService.toSafe(user);
    const dateKey = toDateKey(new Date(), user.timezone);

    const streaks = character.streaks as unknown as Record<
      string,
      { current: number; shields: number; lastDateKey: string | null }
    >;

    return {
      user: {
        id: userSafe.userId,
        email: userSafe.email,
        username: userSafe.username,
        timezone: userSafe.timezone,
      },
      character: {
        totalXp: character.totalXp,
        level: character.level,
        currentLevelXp: character.currentLevelXp,
        xpToNextLevel: character.xpToNextLevel,
        rank: character.rank,
        gold: character.gold,
        stats: {
          STR: character.stats.STR,
          INT: character.stats.INT,
          WIS: character.stats.WIS,
          DEX: character.stats.DEX,
          CHA: character.stats.CHA,
          END: character.stats.END,
        },
        avatarEmoji: character.avatarEmoji,
        className: character.className,
        streaks: {
          gym:       { current: streaks['gym']?.current ?? 0, shields: streaks['gym']?.shields ?? 0, lastDateKey: streaks['gym']?.lastDateKey ?? null },
          code:      { current: streaks['code']?.current ?? 0, shields: streaks['code']?.shields ?? 0, lastDateKey: streaks['code']?.lastDateKey ?? null },
          reading:   { current: streaks['reading']?.current ?? 0, shields: streaks['reading']?.shields ?? 0, lastDateKey: streaks['reading']?.lastDateKey ?? null },
          earlyRise: { current: streaks['earlyRise']?.current ?? 0, shields: streaks['earlyRise']?.shields ?? 0, lastDateKey: streaks['earlyRise']?.lastDateKey ?? null },
        },
        totalHabitsCompleted: character.totalHabitsCompleted,
        lastActiveDate: character.lastActiveDate,
      },
      habits: {
        daily: dailyHabits,
        weekly: weeklyHabits,
      },
      achievements: {
        recentUnlocked,
        totalUnlocked: unlockedAchs.length,
        totalAvailable: achievements.length,
      },
      xp: {
        recentEvents: xpData.events,
      },
      today: {
        dateKey,
        completedDailyCount,
        totalDailyCount: dailyHabits.length,
      },
    };
  }
}
