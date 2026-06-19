import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import { Habit, HabitDocument } from './schemas/habit.schema';
import { HabitLog, HabitLogDocument } from './schemas/habit-log.schema';
import { DAILY_HABITS, WEEKLY_HABITS } from './seeds/default-habits.seed';
import { XpService } from '../xp/xp.service';
import { CharactersService } from '../characters/characters.service';
import { AchievementsService, UnlockedAchievementResult } from '../achievements/achievements.service';
import { Character, CharacterDocument } from '../characters/schemas/character.schema';
import { UsersService } from '../users/users.service';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { UndoHabitDto } from './dto/undo-habit.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { HabitLogResponseDto } from './dto/habit-log-response.dto';
import { toDateKey, toWeekKey, weekStartDateKey } from '../common/utils/date.utils';

export interface WeeklyAutoResult {
  habitId: string;
  name: string;
  xpAwarded: number;
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
  unlockedAchievements: UnlockedAchievementResult[];
  weeklyAutoCompleted: WeeklyAutoResult[];
}

@Injectable()
export class HabitsService {
  private readonly logger = new Logger(HabitsService.name);

  constructor(
    @InjectModel(Habit.name) private habitModel: Model<HabitDocument>,
    @InjectModel(HabitLog.name) private habitLogModel: Model<HabitLogDocument>,
    @InjectModel(Character.name) private characterModel: Model<CharacterDocument>,
    @InjectConnection() private connection: Connection,
    private xpService: XpService,
    private charactersService: CharactersService,
    private achievementsService: AchievementsService,
    private usersService: UsersService,
  ) {}

  // ─── Seeding ─────────────────────────────────────────────────────────────────

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

    const habitIds = habits.map((h) => h._id);

    const [todayLogs, weekLogs] = await Promise.all([
      this.habitLogModel
        .find({
          userId: new Types.ObjectId(userId),
          habitId: { $in: habitIds },
          dateKey: todayKey,
          logType: 'daily',
          undone: false,
        })
        .select('habitId')
        .exec(),
      this.habitLogModel
        .find({
          userId: new Types.ObjectId(userId),
          habitId: { $in: habitIds },
          weekKey: currentWeekKey,
          logType: { $in: ['weekly_manual', 'weekly_auto'] },
          undone: false,
        })
        .select('habitId')
        .exec(),
    ]);

    const completedTodaySet = new Set(todayLogs.map((l) => l.habitId.toString()));
    const completedWeekSet = new Set(weekLogs.map((l) => l.habitId.toString()));

    const result: HabitResponseDto[] = [];

    for (const habit of habits) {
      const habitIdStr = (habit._id as Types.ObjectId).toString();

      if (habit.frequency === 'daily') {
        result.push({
          id: habitIdStr,
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
          completedToday: completedTodaySet.has(habitIdStr),
        });
      } else {
        // Weekly habit — compute progress
        const completedThisWeek = completedWeekSet.has(habitIdStr);
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
        } else if (habit.weeklyTrackingMode === 'manual') {
          // For manual mode: progress = 1 if completed this week, else 0
          progress = completedThisWeek ? 1 : 0;
        }

        result.push({
          id: habitIdStr,
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
          completedThisWeek,
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
      if (
        dto.weeklyTrackingMode === 'category_count' ||
        dto.weeklyTrackingMode === 'habit_count'
      ) {
        if (!dto.weeklyTarget) throw new BadRequestException('weeklyTarget is required');
      }
      if (dto.weeklyTrackingMode === 'category_count' && !dto.weeklyCategory) {
        throw new BadRequestException('weeklyCategory is required for category_count mode');
      }
      if (dto.weeklyTrackingMode === 'habit_count') {
        if (!dto.weeklyHabitIds?.length)
          throw new BadRequestException('weeklyHabitIds is required for habit_count mode');
      }
    }

    const weeklyHabitObjectIds = dto.weeklyHabitIds?.map((id) => new Types.ObjectId(id)) ?? [];

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
      weeklyCategory:
        dto.weeklyTrackingMode === 'category_count' ? (dto.weeklyCategory ?? null) : null,
      weeklyHabitIds: dto.weeklyTrackingMode === 'habit_count' ? weeklyHabitObjectIds : [],
      isActive: true,
      sortOrder: dto.sortOrder ?? 0,
    });

    return this.toHabitResponse(habit, null, null);
  }

  async updateHabit(
    habitId: string,
    userId: string,
    dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
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

  async completeHabit(
    userId: string,
    habitId: string,
    dto: CompleteHabitDto,
  ): Promise<CompleteHabitResponse> {
    const userObjId = new Types.ObjectId(userId);
    const habitObjId = new Types.ObjectId(habitId);

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const habit = await this.habitModel
      .findOne({ _id: habitObjId, userId: userObjId, isActive: true })
      .exec();
    if (!habit) throw new NotFoundException('Habit not found');

    // Validate completedAt timing
    const completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();
    const now = new Date();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (now.getTime() - completedAt.getTime() > FORTY_EIGHT_HOURS) {
      throw new UnprocessableEntityException('completedAt must be within the last 48 hours');
    }
    if (completedAt.getTime() - now.getTime() > FIVE_MINUTES) {
      throw new UnprocessableEntityException(
        'completedAt cannot be more than 5 minutes in the future',
      );
    }

    const dateKey = toDateKey(completedAt, user.timezone);
    const weekKey = toWeekKey(completedAt, user.timezone);

    // Idempotency: syncId already exists
    const existingBySyncId = await this.habitLogModel.findOne({ syncId: dto.syncId }).exec();
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
      } as unknown as CompleteHabitResponse;
    }

    if (habit.frequency === 'daily') {
      return this.completeDailyHabit(
        userObjId, habitObjId, habit, dto, completedAt, dateKey, weekKey, user.timezone,
      );
    } else {
      // Weekly habit
      if (
        habit.weeklyTrackingMode === 'category_count' ||
        habit.weeklyTrackingMode === 'habit_count'
      ) {
        throw new UnprocessableEntityException(
          'Auto-completion habits cannot be manually completed; they complete automatically when the target is reached',
        );
      }
      // manual weekly
      return this.completeManualWeeklyHabit(
        userObjId, habitObjId, habit, dto, completedAt, dateKey, weekKey,
      );
    }
  }

  private async completeDailyHabit(
    userObjId: Types.ObjectId,
    habitObjId: Types.ObjectId,
    habit: HabitDocument,
    dto: CompleteHabitDto,
    completedAt: Date,
    dateKey: string,
    weekKey: string,
    timezone: string,
  ): Promise<CompleteHabitResponse> {
    // Pre-tx duplicate check
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

    const session = await this.connection.startSession();
    try {
      let response!: CompleteHabitResponse;

      await session.withTransaction(async () => {
        // 1. Insert daily habit_log
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

        // 2. XP event for habit completion
        const xpResult = await this.xpService.addXpEvent(
          userObjId,
          habit.xpReward,
          'habit_complete',
          'habit_logs',
          dailyLog._id as Types.ObjectId,
          session,
        );
        const levelBefore = xpResult.levelBefore;

        // 3. Update character counters
        await this.characterModel.findOneAndUpdate(
          { userId: userObjId },
          { $inc: { totalHabitsCompleted: 1 }, lastActiveDate: dateKey },
          { session },
        ).exec();

        // 4. Streak update
        let streakUpdate: CompleteHabitResponse['streakUpdate'] = null;
        if (habit.streakKey) {
          const sr = await this.charactersService.updateStreakCache(
            userObjId, habit.streakKey, dateKey, timezone, session,
          );
          streakUpdate = { streakKey: habit.streakKey, ...sr };
        }

        // 5. Weekly auto-completion check
        const weeklyAutoCompleted = await this.checkAndAwardWeeklyAutoCompletions(
          userObjId, dateKey, weekKey, timezone, session,
        );

        // 6. Achievement evaluation (up to 3 passes, reads fresh character each time)
        const unlockedAchievements = await this.achievementsService.evaluateAndUnlockAchievements(
          userObjId, session,
        );

        // 7. Re-read final character state after all XP events
        const finalChar = await this.characterModel
          .findOne({ userId: userObjId })
          .session(session)
          .exec();

        response = {
          habitLogId: (dailyLog._id as Types.ObjectId).toString(),
          xpAwarded: habit.xpReward,
          newTotalXp: finalChar?.totalXp ?? xpResult.newTotalXp,
          previousLevel: levelBefore,
          newLevel: finalChar?.level ?? xpResult.levelAfter,
          levelUp: (finalChar?.level ?? xpResult.levelAfter) > levelBefore,
          newRank: finalChar?.rank ?? xpResult.rankAfter,
          streakUpdate,
          unlockedAchievements,
          weeklyAutoCompleted,
        };
      });

      return response;
    } finally {
      await session.endSession();
    }
  }

  private async completeManualWeeklyHabit(
    userObjId: Types.ObjectId,
    habitObjId: Types.ObjectId,
    habit: HabitDocument,
    dto: CompleteHabitDto,
    completedAt: Date,
    dateKey: string,
    weekKey: string,
  ): Promise<CompleteHabitResponse> {
    // Pre-tx duplicate check
    const duplicateExists = await this.habitLogModel.exists({
      userId: userObjId,
      habitId: habitObjId,
      weekKey,
      undone: false,
      logType: 'weekly_manual',
    });
    if (duplicateExists) {
      throw new ConflictException('Already completed this weekly habit this week');
    }

    const session = await this.connection.startSession();
    try {
      let response!: CompleteHabitResponse;

      await session.withTransaction(async () => {
        // 1. Insert weekly_manual habit_log
        const [weeklyLog] = await this.habitLogModel.create(
          [
            {
              userId: userObjId,
              habitId: habitObjId,
              logType: 'weekly_manual',
              source: 'manual',
              dateKey,
              weekKey,
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

        // 2. XP event
        const xpResult = await this.xpService.addXpEvent(
          userObjId,
          habit.xpReward,
          'habit_complete',
          'habit_logs',
          weeklyLog._id as Types.ObjectId,
          session,
        );
        const levelBefore = xpResult.levelBefore;

        // Weekly completions do NOT increment totalHabitsCompleted

        // 3. Achievement evaluation
        const unlockedAchievements = await this.achievementsService.evaluateAndUnlockAchievements(
          userObjId, session,
        );

        // 4. Re-read final character state
        const finalChar = await this.characterModel
          .findOne({ userId: userObjId })
          .session(session)
          .exec();

        response = {
          habitLogId: (weeklyLog._id as Types.ObjectId).toString(),
          xpAwarded: habit.xpReward,
          newTotalXp: finalChar?.totalXp ?? xpResult.newTotalXp,
          previousLevel: levelBefore,
          newLevel: finalChar?.level ?? xpResult.levelAfter,
          levelUp: (finalChar?.level ?? xpResult.levelAfter) > levelBefore,
          newRank: finalChar?.rank ?? xpResult.rankAfter,
          streakUpdate: null,
          unlockedAchievements,
          weeklyAutoCompleted: [],
        };
      });

      return response;
    } finally {
      await session.endSession();
    }
  }

  // Step 11 of completion algorithm: check and award weekly auto-completions inside an existing transaction.
  private async checkAndAwardWeeklyAutoCompletions(
    userObjId: Types.ObjectId,
    dateKey: string,
    weekKey: string,
    timezone: string,
    session: ClientSession,
  ): Promise<WeeklyAutoResult[]> {
    const weekStartKey = weekStartDateKey(weekKey, timezone);
    const awarded: WeeklyAutoResult[] = [];

    const weeklyAutoHabits = await this.habitModel
      .find({
        userId: userObjId,
        frequency: 'weekly',
        isActive: true,
        weeklyTrackingMode: { $in: ['category_count', 'habit_count'] },
      })
      .session(session)
      .exec();

    for (const weeklyHabit of weeklyAutoHabits) {
      // Check already completed this week (read from session — sees all in-tx writes)
      const alreadyDone = await this.habitLogModel
        .exists({
          userId: userObjId,
          habitId: weeklyHabit._id,
          weekKey,
          undone: false,
          logType: { $in: ['weekly_manual', 'weekly_auto'] },
        })
        .session(session)
        .exec();
      if (alreadyDone) continue;

      // Compute progress
      let progress = 0;
      if (weeklyHabit.weeklyTrackingMode === 'category_count') {
        progress = await this.habitLogModel.countDocuments(
          {
            userId: userObjId,
            'habitSnapshot.category': weeklyHabit.weeklyCategory,
            dateKey: { $gte: weekStartKey, $lte: dateKey },
            logType: 'daily',
            undone: false,
          },
          { session },
        );
      } else if (weeklyHabit.weeklyTrackingMode === 'habit_count') {
        // Full week — order of completions doesn't matter for "complete all N habits"
        progress = await this.habitLogModel.countDocuments(
          {
            userId: userObjId,
            habitId: { $in: weeklyHabit.weeklyHabitIds },
            dateKey: { $gte: weekStartKey },
            logType: 'daily',
            undone: false,
          },
          { session },
        );
      }

      if (weeklyHabit.weeklyTarget !== null && progress >= weeklyHabit.weeklyTarget) {
        try {
          const [autoLog] = await this.habitLogModel.create(
            [
              {
                userId: userObjId,
                habitId: weeklyHabit._id,
                logType: 'weekly_auto',
                source: 'auto',
                dateKey,
                weekKey,
                completedAt: new Date(),
                xpAwarded: weeklyHabit.xpReward,
                habitSnapshot: {
                  name: weeklyHabit.name,
                  category: weeklyHabit.category,
                  difficulty: weeklyHabit.difficulty,
                  xpReward: weeklyHabit.xpReward,
                },
                syncId: null,
                undone: false,
              },
            ],
            { session },
          );

          await this.xpService.addXpEvent(
            userObjId,
            weeklyHabit.xpReward,
            'habit_complete',
            'habit_logs',
            autoLog._id as Types.ObjectId,
            session,
          );

          awarded.push({
            habitId: (weeklyHabit._id as Types.ObjectId).toString(),
            name: weeklyHabit.name,
            xpAwarded: weeklyHabit.xpReward,
          });

          this.logger.log(`Weekly auto-completion awarded: ${weeklyHabit.name} for user ${userObjId.toString()}`);
        } catch (err: unknown) {
          // Duplicate key — race condition: another concurrent request already completed it; skip silently
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: number }).code === 11000
          ) {
            continue;
          }
          throw err;
        }
      }
    }

    return awarded;
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
      let xpResult!: import('../xp/xp.service').AddXpEventResult;

      await session.withTransaction(async () => {
        // Mark log undone
        await this.habitLogModel
          .findByIdAndUpdate(habitLog._id, { undone: true, undoneAt: new Date() }, { session })
          .exec();

        // Revert XP
        xpResult = await this.xpService.addXpEvent(
          userObjId,
          -habitLog.xpAwarded,
          'habit_undo',
          'habit_logs',
          habitLog._id as Types.ObjectId,
          session,
        );

        // Decrement totalHabitsCompleted (floor 0)
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

        // Recompute streak if needed — weekly auto-completions are NOT reversed (MVP rule)
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
        xpReverted: Math.abs(xpResult.actualDelta),
        newTotalXp: xpResult.newTotalXp,
        newLevel: xpResult.levelAfter,
        newRank: xpResult.rankAfter,
        weeklyAutoNote:
          'Weekly auto-completions triggered by this habit are not reversed',
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

  async getHeatmap(
    userId: string,
    from: string,
    to: string,
  ): Promise<{ dateKey: string; completedCount: number }[]> {
    const rows = await this.habitLogModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          logType: 'daily',
          undone: false,
          dateKey: { $gte: from, $lte: to },
        },
      },
      {
        $group: { _id: '$dateKey', count: { $sum: 1 } },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((r) => ({ dateKey: r._id, completedCount: r.count }));
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
