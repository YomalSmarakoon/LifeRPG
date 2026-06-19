import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Habit, HabitDocument } from '../habits/schemas/habit.schema';
import { HabitLog, HabitLogDocument } from '../habits/schemas/habit-log.schema';
import { XpEvent, XpEventDocument } from '../xp/schemas/xp-event.schema';
import { UserAchievement, UserAchievementDocument } from '../achievements/schemas/user-achievement.schema';
import { AchievementDefinition, AchievementDefinitionDocument } from '../achievements/schemas/achievement-definition.schema';
import { UsersService } from '../users/users.service';
import { CharactersService } from '../characters/characters.service';

@Injectable()
export class DataExportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly charactersService: CharactersService,
    @InjectModel(Habit.name) private habitModel: Model<HabitDocument>,
    @InjectModel(HabitLog.name) private habitLogModel: Model<HabitLogDocument>,
    @InjectModel(XpEvent.name) private xpEventModel: Model<XpEventDocument>,
    @InjectModel(UserAchievement.name) private userAchievementModel: Model<UserAchievementDocument>,
    @InjectModel(AchievementDefinition.name) private achievementDefModel: Model<AchievementDefinitionDocument>,
  ) {}

  async exportData(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const character = await this.charactersService.findByUserId(userId);

    const [habits, habitLogs, xpEvents, userAchievements, achDefs] = await Promise.all([
      this.habitModel.find({ userId: userObjId }).sort({ sortOrder: 1 }).lean().exec(),
      this.habitLogModel.find({ userId: userObjId }).sort({ completedAt: -1 }).lean().exec(),
      this.xpEventModel.find({ userId: userObjId }).sort({ timestamp: -1 }).lean().exec(),
      this.userAchievementModel.find({ userId: userObjId }).lean().exec(),
      this.achievementDefModel.find().lean().exec(),
    ]);

    const userSafe = this.usersService.toSafe(user);

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: 'mvp-1.0',
      user: userSafe,
      character: character
        ? {
            level: character.level,
            totalXp: character.totalXp,
            currentLevelXp: character.currentLevelXp,
            xpToNextLevel: character.xpToNextLevel,
            rank: character.rank,
            gold: character.gold,
            stats: character.stats,
            avatarEmoji: character.avatarEmoji,
            className: character.className,
            streaks: character.streaks,
            totalHabitsCompleted: character.totalHabitsCompleted,
            lastActiveDate: character.lastActiveDate,
          }
        : null,
      habits: habits.map((h) => ({
        id: (h._id as Types.ObjectId).toString(),
        name: h.name,
        icon: h.icon,
        category: h.category,
        frequency: h.frequency,
        xpReward: h.xpReward,
        difficulty: h.difficulty,
        isActive: h.isActive,
        sortOrder: h.sortOrder,
        streakKey: h.streakKey,
        weeklyTrackingMode: h.weeklyTrackingMode,
        weeklyTarget: h.weeklyTarget,
        weeklyCategory: h.weeklyCategory,
      })),
      habitLogs: habitLogs.map((l) => ({
        id: (l._id as Types.ObjectId).toString(),
        habitId: l.habitId.toString(),
        logType: l.logType,
        dateKey: l.dateKey,
        weekKey: l.weekKey,
        completedAt: l.completedAt,
        xpAwarded: l.xpAwarded,
        undone: l.undone,
        undoneAt: l.undoneAt,
        habitSnapshot: l.habitSnapshot,
      })),
      xpEvents: xpEvents.map((e) => ({
        id: (e._id as Types.ObjectId).toString(),
        delta: e.delta,
        source: e.source,
        contextType: e.contextType,
        balanceBefore: e.balanceBefore,
        balanceAfter: e.balanceAfter,
        timestamp: e.timestamp,
      })),
      achievements: {
        definitions: achDefs.map((d) => ({
          code: d.code,
          name: d.name,
          icon: d.icon,
          description: d.description,
          xpReward: d.xpReward,
          category: d.category,
          condition: d.condition,
        })),
        unlocked: userAchievements.map((ua) => ({
          achievementCode: ua.achievementCode,
          unlockedAt: ua.unlockedAt,
          xpAwarded: ua.xpAwarded,
        })),
      },
    };
  }
}
