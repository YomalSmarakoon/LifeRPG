import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HabitLogDocument = HydratedDocument<HabitLog>;

@Schema({ _id: false })
class HabitSnapshot {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) category!: string;
  @Prop({ required: true }) difficulty!: string;
  @Prop({ required: true }) xpReward!: number;
}
const HabitSnapshotSchema = SchemaFactory.createForClass(HabitSnapshot);

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'habit_logs' })
export class HabitLog {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Habit' })
  habitId!: Types.ObjectId;

  @Prop({ required: true, enum: ['daily', 'weekly_manual', 'weekly_auto'] })
  logType!: 'daily' | 'weekly_manual' | 'weekly_auto';

  @Prop({ required: true, enum: ['manual', 'auto'] })
  source!: 'manual' | 'auto';

  @Prop({ required: true })
  dateKey!: string;

  @Prop({ type: String, default: null })
  weekKey!: string | null;

  @Prop({ required: true })
  completedAt!: Date;

  @Prop({ required: true })
  xpAwarded!: number;

  @Prop({ type: HabitSnapshotSchema, required: true })
  habitSnapshot!: HabitSnapshot;

  @Prop({ type: String, default: null })
  syncId!: string | null;

  @Prop({ default: false })
  undone!: boolean;

  @Prop({ type: Date, default: null })
  undoneAt!: Date | null;
}

export const HabitLogSchema = SchemaFactory.createForClass(HabitLog);

// Indexes per spec Section 3.5
HabitLogSchema.index({ userId: 1, dateKey: 1 });
HabitLogSchema.index({ userId: 1, habitId: 1, dateKey: -1 });
HabitLogSchema.index({ userId: 1, 'habitSnapshot.category': 1, dateKey: 1 });

HabitLogSchema.index(
  { userId: 1, habitId: 1, dateKey: 1 },
  {
    unique: true,
    partialFilterExpression: { undone: false, logType: 'daily' },
    name: 'habit_logs_daily_no_duplicate',
  },
);

HabitLogSchema.index(
  { userId: 1, habitId: 1, weekKey: 1 },
  {
    unique: true,
    partialFilterExpression: { undone: false, weekKey: { $type: 'string' } },
    name: 'habit_logs_weekly_no_duplicate',
  },
);

HabitLogSchema.index({ syncId: 1 }, { unique: true, sparse: true });
