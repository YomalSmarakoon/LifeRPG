import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserAchievementDocument = HydratedDocument<UserAchievement>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'user_achievements' })
export class UserAchievement {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'AchievementDefinition' })
  achievementDefinitionId!: Types.ObjectId;

  @Prop({ required: true })
  achievementCode!: string;

  @Prop({ required: true })
  unlockedAt!: Date;

  @Prop({ required: true })
  xpAwarded!: number;
}

export const UserAchievementSchema = SchemaFactory.createForClass(UserAchievement);

// Indexes per spec Section 3.8
UserAchievementSchema.index(
  { userId: 1, achievementDefinitionId: 1 },
  { unique: true },
);
UserAchievementSchema.index({ userId: 1, unlockedAt: -1 });
