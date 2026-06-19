import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HabitDocument = HydratedDocument<Habit>;

export type HabitCategory = 'fitness' | 'coding' | 'reading' | 'career' | 'wellness' | 'custom';
export type HabitFrequency = 'daily' | 'weekly';
export type HabitDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';
export type WeeklyTrackingMode = 'manual' | 'category_count' | 'habit_count';

@Schema({ timestamps: true, collection: 'habits' })
export class Habit {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '📋' })
  icon!: string;

  @Prop({
    required: true,
    enum: ['fitness', 'coding', 'reading', 'career', 'wellness', 'custom'],
  })
  category!: HabitCategory;

  @Prop({ required: true, enum: ['daily', 'weekly'] })
  frequency!: HabitFrequency;

  @Prop({ required: true, min: 1 })
  xpReward!: number;

  @Prop({ required: true, enum: ['easy', 'medium', 'hard', 'legendary'] })
  difficulty!: HabitDifficulty;

  // Daily habits — streak association key
  @Prop({ type: String, default: null })
  streakKey!: string | null;

  // Weekly habit fields
  @Prop({ type: Number, default: null })
  weeklyTarget!: number | null;

  @Prop({
    type: String,
    enum: ['manual', 'category_count', 'habit_count', null],
    default: null,
  })
  weeklyTrackingMode!: WeeklyTrackingMode | null;

  @Prop({ type: String, default: null })
  weeklyCategory!: string | null;

  @Prop({ type: [Types.ObjectId], default: [] })
  weeklyHabitIds!: Types.ObjectId[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;
}

export const HabitSchema = SchemaFactory.createForClass(Habit);

// Indexes per spec Section 3.4
HabitSchema.index({ userId: 1, frequency: 1, isActive: 1 });
HabitSchema.index({ userId: 1, weeklyCategory: 1, isActive: 1 });
