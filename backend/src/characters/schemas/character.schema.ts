import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CharacterDocument = HydratedDocument<Character>;

@Schema({ _id: false })
class StreakState {
  @Prop({ default: 0 })
  current!: number;

  @Prop({ default: 0 })
  shields!: number;

  @Prop({ type: String, default: null })
  lastDateKey!: string | null;
}
const StreakStateSchema = SchemaFactory.createForClass(StreakState);

@Schema({ _id: false })
class CharacterStreaks {
  @Prop({ type: StreakStateSchema, default: () => ({ current: 0, shields: 0, lastDateKey: null }) })
  gym!: StreakState;

  @Prop({ type: StreakStateSchema, default: () => ({ current: 0, shields: 0, lastDateKey: null }) })
  code!: StreakState;

  @Prop({ type: StreakStateSchema, default: () => ({ current: 0, shields: 0, lastDateKey: null }) })
  reading!: StreakState;

  @Prop({ type: StreakStateSchema, default: () => ({ current: 0, shields: 0, lastDateKey: null }) })
  earlyRise!: StreakState;
}
const CharacterStreaksSchema = SchemaFactory.createForClass(CharacterStreaks);

@Schema({ _id: false })
class CharacterStats {
  @Prop({ default: 10 }) STR!: number;
  @Prop({ default: 10 }) INT!: number;
  @Prop({ default: 10 }) WIS!: number;
  @Prop({ default: 10 }) DEX!: number;
  @Prop({ default: 10 }) CHA!: number;
  @Prop({ default: 10 }) END!: number;
}
const CharacterStatsSchema = SchemaFactory.createForClass(CharacterStats);

@Schema({ timestamps: true, collection: 'characters' })
export class Character {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ default: 0 })
  totalXp!: number;

  @Prop({ default: 1 })
  level!: number;

  @Prop({ default: 0 })
  currentLevelXp!: number;

  @Prop({ default: 500 })
  xpToNextLevel!: number;

  @Prop({ default: 'Bronze' })
  rank!: string;

  @Prop({ default: 0 })
  gold!: number;

  @Prop({ type: CharacterStatsSchema, default: () => ({ STR: 10, INT: 10, WIS: 10, DEX: 10, CHA: 10, END: 10 }) })
  stats!: CharacterStats;

  @Prop({ default: '⚔️', maxlength: 4 })
  avatarEmoji!: string;

  @Prop({ default: 'Software Engineer', maxlength: 60 })
  className!: string;

  @Prop({ type: CharacterStreaksSchema, default: () => ({}) })
  streaks!: CharacterStreaks;

  @Prop({ default: 0 })
  totalHabitsCompleted!: number;

  @Prop({ type: String, default: null })
  lastActiveDate!: string | null;
}

export const CharacterSchema = SchemaFactory.createForClass(Character);

// Index per spec Section 3.3
CharacterSchema.index({ userId: 1 }, { unique: true });
