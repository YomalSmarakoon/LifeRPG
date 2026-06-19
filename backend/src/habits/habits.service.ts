import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Habit, HabitDocument } from './schemas/habit.schema';
import { DAILY_HABITS, WEEKLY_HABITS } from './seeds/default-habits.seed';

@Injectable()
export class HabitsService {
  private readonly logger = new Logger(HabitsService.name);

  constructor(@InjectModel(Habit.name) private habitModel: Model<HabitDocument>) {}

  async seedDefaults(userId: string): Promise<void> {
    const userObjId = new Types.ObjectId(userId);

    // Idempotency check — skip if habits already exist for this user
    const existing = await this.habitModel.countDocuments({ userId: userObjId }).exec();
    if (existing > 0) {
      this.logger.debug(`Habits already seeded for user ${userId}, skipping`);
      return;
    }

    // Step 1: insert daily habits and capture their ObjectIds in order
    const dailyDocs = await this.habitModel.insertMany(
      DAILY_HABITS.map((seed) => ({ userId: userObjId, ...seed })),
    );

    // Step 2: build weeklyHabitIds from the daily docs for habit_count weekly habits
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
}
