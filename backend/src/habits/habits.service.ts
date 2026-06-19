import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Habit, HabitDocument } from './schemas/habit.schema';
import { HabitLog, HabitLogDocument } from './schemas/habit-log.schema';
import { DAILY_HABITS, WEEKLY_HABITS } from './seeds/default-habits.seed';
import { XpService } from '../xp/xp.service';
import { CharactersService } from '../characters/characters.service';
import { Character } from '../characters/schemas/character.schema';
import { UsersService } from '../users/users.service';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { UndoHabitDto } from './dto/undo-habit.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { HabitLogResponseDto } from './dto/habit-log-response.dto';
import { toDateKey, toWeekKey, weekStartDateKey } from '../common/utils/date.utils';

@Injectable()
export class HabitsService {
  private readonly logger = new Logger(HabitsService.name);

  constructor(
    @InjectModel(Habit.name) private habitModel: Model<HabitDocument>,
    @InjectModel(HabitLog.name) private habitLogModel: Model<HabitLogDocument>,
    @InjectModel(Character.name) private characterModel: Model<import('../characters/schemas/character.schema').CharacterDocument>,
    @InjectConnection() private connection: Connection,
    private xpService: XpService,
    private charactersService: CharactersService,
    private usersService: UsersService,
  ) {}

  // ─── Seeding (Phase 4) ──────────────────────────────────────────────────────

  async seedDefaults(userId: string): Promise<void> {
    const userObjId = new Types.ObjectId(userId);

    const existing = await this.habitModel.countDocuments({ userId: userObjId }).exec();
    if (existing > 0) {
      this.logger.debug(`Habits already seeded for user ${userId}, skipping`);
      return;
    }

    const dailyDocs = await this.habitModel.insertMany(
      DAILY_HABITS.map((seed) => ({ userId: userObjId, ...seed })),
    );

    const weeklyDocs = WEEKLY_HABITS.map((seed) => {
      const weeklyHabitIds = seed.weeklyHabitIndices.map(
        (idx) => (dailyDocs[idx] as unknown as { _id: Types.ObjectId })._id,
      );
      const { weeklyHabitIndices: _drop, ...rest } = seed;
      return { userId: userObjId, ...rest, weeklyHabitIds };
    });

    await this.habitModel.insertMany(weeklyDocs);

    this.logger.log(`Seeded ${dailyDocs.length} daily + ${weeklyDocs.length} weekly habits for user ${userId}`);
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async listHabits(
    userId: string,
    frequency?: string,
    active?: boolean,
  ): Promise<{ habits: HabitResponseDto[] }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (frequency) query['frequency'] = frequency;
    if (active !== undefined) query['isActive'] = active;

    const habits = await this.habitModel.find(query).sort({ sortOrder: 1, createdAt: 1 }).exec();

    const timezone = user.timezone;
    const now = new Date();
    const todayKey = toDateKey(now, timezone);
    const currentWeekKey = toWeekKey(now, timezone);
    const weekStartKey = weekStartDateKey(currentWeekKey, timezone);

    // Batch-fetch today's daily logs for this user
    const habitIds = habits.map((h) => h._id);
    const todayLogs = await this.habitLogModel
      .find({
        userId: new Types.ObjectId(userId),
        habitId: { $in: habitIds },
        dateKey: todayKey,
        logType: 'daily',
        undone: false,
      })
      .select('habitId')
      .exec();
    const completedTodaySet = new Set(todayLogs.map((l) => l.habitId.toString()));

    // Batch-fetch this week's weekly logs
    const weekLogs = await this.habitLogModel
      .find({
        userId: new Types.ObjectId(userId),
        habitId: { $in: habitIds },
        weekKey: currentWeekKey,
        logType: { $in: ['weekly_manual', 'weekly_auto'] },
        undone: false,
      })
      .select('habitId')
      .exec();
    const completedWeekSet = new Set(weekLogs.map((l) => l.habitId.toString()));

    const result: HabitResponseDto[] = [];

    for (const habit of habits) {
      if (habit.frequency === 'daily') {
        result.push({
          id: (habit._id as Types.ObjectId).toString(),
          name: habit.name,
          icon: habit.icon,
          category: habit.category,
          frequency: habit.frequency,
          xpReward: habit.xpReward,
          difficulty: habit.difficulty,
          isActive: habit.isActive,
          sortOrder: habit.sortOrder,
          streakKey: habit.streakKey,
          dateKey: todayKey,
          completedToday: completedTodaySet.has((habit._id as Types.ObjectId).toString()),
        });
      } else {
        // Weekly habit — compute progress
        let progress = 0;
        if (habit.weeklyTrackingMode === 'category_count') {
          progress = await this.habitLogModel.countDocuments({
            userId: new Types.ObjectId(userId),
            'habitSnapshot.category': habit.weeklyCategory,
            dateKey: { $gte: weekStartKey, $lte: todayKey },
            logType: 'daily',
            undone: false,
          });
        } else if (habit.weeklyTrackingMode === 'habit_count') {
          progress = await this.habitLogModel.countDocuments({
            userId: new Types.ObjectId(userId),
            habitId: { $in: habit.weeklyHabitIds },
            dateKey: { $gte: weekStartKey, $lte: todayKey },
            logType: 'daily',
            undone: false,
          });
        }

        result.push({
          id: (habit._id as Types.ObjectId).toString(),
          name: habit.name,
          icon: habit.icon,
          category: habit.category,
          frequency: habit.frequency,
          xpReward: habit.xpReward,
          difficulty: habit.difficulty,
          isActive: habit.isActive,
          sortOrder: habit.sortOrder,
          weeklyTrackingMode: habit.weeklyTrackingMode,
          weeklyTarget: habit.weeklyTarget,
          weeklyCategory: habit.weeklyCategory,
          weeklyHabitIds: habit.weeklyHabitIds.map((id) => id.toString()),
          weekKey: currentWeekKey,
          progress,
          completedThisWeek: completedWeekSet.has((habit._id as Types.ObjectId).toString()),
        });
      }
    }

    return { habits: result };
  }

  async getHabit(habitId: string, userId: string): Promise<HabitDocument> {
    const habit = await this.habitModel
      .findOne({ _id: new Types.ObjectId(habitId), userId: new Types.ObjectId(userId) })
      .exec();
    if (!habit) throw new NotFoundException('Habit not found');
    return habit;
  }

  async createHabit(userId: string, dto: CreateHabitDto): Promise<HabitResponseDto> {
    const userObjId = new Types.ObjectId(userId);
    const activeCount = await this.habitModel.countDocuments({ userId: userObjId, isActive: true });
    if (activeCount >= 50) {
      throw new BadRequestException('Maximum of 50 active habits reached');
    }

    if (dto.frequency === 'weekly') {
      if (!dto.weeklyTrackingMode) {
        throw new BadRequestException('weeklyTrackingMode is required for weekly habits');
      }
      if (dto.weeklyTrackingMode === 'category_count' || dto.weeklyTrackingMode === 'habit_count') {
        if (!dto.weeklyTarget) throw new BadRequestException('weeklyTarget is required');
      }
      if (dto.weeklyTrackingMode === 'category_count' && !dto.weeklyCategory) {
        throw new BadRequestException('weeklyCategory is required for category_count mode');
      }
      if (dto.weeklyTrackingMode === 'habit_count') {
        if (!dto.weeklyHabitIds?.length) throw new BadRequestException('weeklyHabitIds is required for habit_count mode');
      }
    }

    const weeklyHabitObjectIds =
      dto.weeklyHabitIds?.map((id) => new Types.ObjectId(id)) ?? [];

    const habit = await this.habitModel.create({
      userId: userObjId,
      name: dto.name,
      icon: dto.icon ?? '📋',
      category: dto.category,
      frequency: dto.frequency,
      xpReward: dto.xpReward,
      difficulty: dto.difficulty,
      streakKey: dto.frequency === 'daily' ? (dto.streakKey ?? null) : null,
      weeklyTarget: dto.frequency === 'weekly' ? (dto.weeklyTarget ?? null) : null,
      weeklyTrackingMode: dto.frequency === 'weekly' ? (dto.weeklyTrackingMode ?? null) : null,
      weeklyCategory: dto.weeklyTrackingMode === 'category_count' ? (dto.weeklyCategory ?? null) : null,
      weeklyHabitIds: dto.weeklyTrackingMode === 'habit_count' ? weeklyHabitObjectIds : [],
      isActive: true,
      sortOrder: dto.sortOrder ?? 0,
    });

    return this.toHabitResponse(habit, null, null);
  }

  async updateHabit(habitId: string, userId: string, dto: UpdateHabitDto): Promise<HabitResponseDto> {
    const habit = await this.getHabit(habitId, userId);

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update['name'] = dto.name;
    if (dto.icon !== undefined) update['icon'] = dto.icon;
    if (dto.xpReward !== undefined) update['xpReward'] = dto.xpReward;
    if (dto.difficulty !== undefined) update['difficulty'] = dto.difficulty;
    if (dto.streakKey !== undefined) update['streakKey'] = dto.streakKey;
    if (dto.isActive !== undefined) update['isActive'] = dto.isActive;
    if (dto.sortOrder !== undefined) update['sortOrder'] = dto.sortOrder;

    const updated = await this.habitModel
      .findByIdAndUpdate(habit._id, update, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Habit not found');

    return this.toHabitResponse(updated, null, null);
  }

  async deleteHabit(habitId: string, userId: string): Promise<void> {
    const habit = await this.getHabit(habitId, userId);
    await this.habitModel.findByIdAndUpdate(habit._id, { isActive: false }).exec();
  }

  // ─── Completion ──────────────────────────────────────────────────────────────

  async completeHabit(userId: string, habitId: string, dto: CompleteHabitDto) {
    const userObjId = new Types.ObjectId(userId);
    const habitObjId = new Types.ObjectId(habitId);

    // Pre-transaction reads
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const habit = await this.habitModel
      .findOne({ _id: habitObjId, userId: userObjId, isActive: true })
      .exec();
    if (!habit) throw new NotFoundException('Habit not found');

    if (habit.frequency === 'weekly') {
      throw new UnprocessableEntityException('Weekly completion will be implemented in Phase 6');
    }

    const completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();
    const now = new Date();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (now.getTime() - completedAt.getTime() > FORTY_EIGHT_HOURS) {
      throw new UnprocessableEntityException('completedAt must be within the last 48 hours');
    }
    if (completedAt.getTime() - now.getTime() > FIVE_MINUTES) {
      throw new UnprocessableEntityException('completedAt cannot be more than 5 minutes in the future');
    }

    const dateKey = toDateKey(completedAt, user.timezone);

    // Idempotency: syncId already exists
    const existingBySyncId = await this.habitLogModel
      .findOne({ syncId: dto.syncId })
      .exec();
    if (existingBySyncId) {
      const char = await this.charactersService.findByUserId(userId);
      return {
        alreadyProcessed: true,
        habitLogId: (existingBySyncId._id as Types.ObjectId).toString(),
        xpAwarded: existingBySyncId.xpAwarded,
        newTotalXp: char?.totalXp ?? 0,
        previousLevel: char?.level ?? 1,
        newLevel: char?.level ?? 1,
        levelUp: false,
        newRank: char?.rank ?? 'Bronze',
        streakUpdate: null,
        unlockedAchievements: [],
        weeklyAutoCompleted: [],
      };
    }

    // Duplicate check: same user/habit/date already done
    const duplicateExists = await this.habitLogModel.exists({
      userId: userObjId,
      habitId: habitObjId,
      dateKey,
      logType: 'daily',
      undone: false,
    });
    if (duplicateExists) {
      throw new ConflictException('Already completed this habit today');
    }

    const character = await this.charactersService.findByUserId(userId);
    if (!character) throw new NotFoundException('Character not found');

    // Transaction
    const session = await this.connection.startSession();
    try {
      let result: ReturnType<typeof this._buildCompleteResponse> extends Promise<infer R> ? R : never;

      await session.withTransaction(async () => {
        // Step 7: insert daily habit_log
        const [dailyLog] = await this.habitLogModel.create(
          [
            {
              userId: userObjId,
              habitId: habitObjId,
              logType: 'daily',
              source: 'manual',
              dateKey,
              weekKey: null,
              completedAt,
              xpAwarded: habit.xpReward,
              habitSnapshot: {
                name: habit.name,
                category: habit.category,
                difficulty: habit.difficulty,
                xpReward: habit.xpReward,
              },
              syncId: dto.syncId,
              undone: false,
            },
          ],
          { session },
        );

        // Step 8: XP event
        const xpResult = await this.xpService.addXpEvent(
          userObjId,
          habit.xpReward,
          'habit_complete',
          'habit_logs',
          dailyLog._id as Types.ObjectId,
          session,
        );

        // Step 9: update character counters
        await this.characterModel.findOneAndUpdate(
          { userId: userObjId },
          {
            $inc: { totalHabitsCompleted: 1 },
            lastActiveDate: dateKey,
          },
          { session },
        );

        // Step 10: streak update
        let streakUpdate: { streakKey: string; newCount: number; shieldEarned: boolean } | null = null;
        if (habit.streakKey) {
          const sr = await this.charactersService.updateStreakCache(
            userObjId,
            habit.streakKey,
            dateKey,
            user.timezone,
            session,
          );
          streakUpdate = { streakKey: habit.streakKey, ...sr };
        }

        // Step 11: weekly auto-completion check (Phase 6 — skip for now)
        const weeklyAutoCompleted: Array<{ habitId: string; name: string; xpAwarded: number }> = [];

        result = {
          habitLogId: (dailyLog._id as Types.ObjectId).toString(),
          xpAwarded: habit.xpReward,
          newTotalXp: xpResult.newTotalXp,
          previousLevel: xpResult.levelBefore,
          newLevel: xpResult.levelAfter,
          levelUp: xpResult.levelAfter > xpResult.levelBefore,
          newRank: xpResult.rankAfter,
          streakUpdate,
          unlockedAchievements: [],
          weeklyAutoCompleted,
        };
      });

      return result!;
    } finally {
      await session.endSession();
    }
  }

  // Needed to keep TS happy — actual return type inferred from usage
  private async _buildCompleteResponse() {
    return {} as {
      habitLogId: string;
      xpAwarded: number;
      newTotalXp: number;
      previousLevel: number;
      newLevel: number;
      levelUp: boolean;
      newRank: string;
      streakUpdate: { streakKey: string; newCount: number; shieldEarned: boolean } | null;
      unlockedAchievements: unknown[];
      weeklyAutoCompleted: Array<{ habitId: string; name: string; xpAwarded: number }>;
    };
  }

  // ─── Undo ────────────────────────────────────────────────────────────────────

  async undoHabit(userId: string, habitId: string, dto: UndoHabitDto) {
    const userObjId = new Types.ObjectId(userId);
    const habitObjId = new Types.ObjectId(habitId);

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const todayKey = toDateKey(new Date(), user.timezone);
    if (dto.dateKey !== todayKey) {
      throw new UnprocessableEntityException("Can only undo today's completions");
    }

    const habit = await this.habitModel
      .findOne({ _id: habitObjId, userId: userObjId })
      .exec();
    if (!habit) throw new NotFoundException('Habit not found');

    const habitLog = await this.habitLogModel
      .findOne({
        userId: userObjId,
        habitId: habitObjId,
        dateKey: dto.dateKey,
        logType: 'daily',
        undone: false,
      })
      .exec();
    if (!habitLog) throw new NotFoundException('No active completion found for this date');

    const session = await this.connection.startSession();
    try {
      let xpResult: import('../xp/xp.service').AddXpEventResult;

      await session.withTransaction(async () => {
        // Step 4: mark log as undone
        await this.habitLogModel
          .findByIdAndUpdate(habitLog._id, { undone: true, undoneAt: new Date() }, { session })
          .exec();

        // Step 5: revert XP
        xpResult = await this.xpService.addXpEvent(
          userObjId,
          -habitLog.xpAwarded,
          'habit_undo',
          'habit_logs',
          habitLog._id as Types.ObjectId,
          session,
        );

        // Step 6: decrement totalHabitsCompleted
        await this.characterModel.findOneAndUpdate(
          { userId: userObjId },
          [
            {
              $set: {
                totalHabitsCompleted: {
                  $max: [0, { $subtract: ['$totalHabitsCompleted', 1] }],
                },
              },
            },
          ],
          { session },
        ).exec();

        // Step 7: recompute streak if needed
        if (habit.streakKey) {
          await this.charactersService.recomputeStreakFromLogs(
            userObjId,
            habit.streakKey,
            user.timezone,
            session,
            this.habitLogModel as Model<unknown>,
            this.habitModel as Model<unknown>,
          );
        }
      });

      return {
        xpReverted: Math.abs(xpResult!.actualDelta),
        newTotalXp: xpResult!.newTotalXp,
        newLevel: xpResult!.levelAfter,
        newRank: xpResult!.rankAfter,
        weeklyAutoNote: 'Weekly auto-completions triggered by this habit are not reversed',
      };
    } finally {
      await session.endSession();
    }
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────────

  async getHabitLogs(
    userId: string,
    habitId: string,
    from?: string,
    to?: string,
    limit = 60,
  ): Promise<{ logs: HabitLogResponseDto[] }> {
    await this.getHabit(habitId, userId);

    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      habitId: new Types.ObjectId(habitId),
    };

    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from) dateFilter['$gte'] = from;
      if (to) dateFilter['$lte'] = to;
      query['dateKey'] = dateFilter;
    }

    const logs = await this.habitLogModel
      .find(query)
      .sort({ dateKey: -1 })
      .limit(Math.min(limit, 200))
      .exec();

    return {
      logs: logs.map((l) => ({
        id: (l._id as Types.ObjectId).toString(),
        logType: l.logType,
        dateKey: l.dateKey,
        completedAt: l.completedAt.toISOString(),
        xpAwarded: l.xpAwarded,
        undone: l.undone,
        habitSnapshot: {
          name: l.habitSnapshot.name,
          xpReward: l.habitSnapshot.xpReward,
        },
      })),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private toHabitResponse(
    habit: HabitDocument,
    completedToday: boolean | null,
    completedThisWeek: boolean | null,
  ): HabitResponseDto {
    const base: HabitResponseDto = {
      id: (habit._id as Types.ObjectId).toString(),
      name: habit.name,
      icon: habit.icon,
      category: habit.category,
      frequency: habit.frequency,
      xpReward: habit.xpReward,
      difficulty: habit.difficulty,
      isActive: habit.isActive,
      sortOrder: habit.sortOrder,
    };

    if (habit.frequency === 'daily') {
      base.streakKey = habit.streakKey;
      if (completedToday !== null) base.completedToday = completedToday;
    } else {
      base.weeklyTrackingMode = habit.weeklyTrackingMode;
      base.weeklyTarget = habit.weeklyTarget;
      base.weeklyCategory = habit.weeklyCategory;
      base.weeklyHabitIds = habit.weeklyHabitIds.map((id) => id.toString());
      if (completedThisWeek !== null) base.completedThisWeek = completedThisWeek;
    }

    return base;
  }
}
