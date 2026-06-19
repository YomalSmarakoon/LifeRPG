import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AchievementDefinitionDocument = HydratedDocument<AchievementDefinition>;

@Schema({ _id: false })
class AchievementCondition {
  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  threshold!: number;
}
const AchievementConditionSchema = SchemaFactory.createForClass(AchievementCondition);

@Schema({ timestamps: true, collection: 'achievement_definitions' })
export class AchievementDefinition {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  icon!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  xpReward!: number;

  @Prop({ required: true })
  category!: string;

  @Prop({ type: AchievementConditionSchema, required: true })
  condition!: AchievementCondition;
}

export const AchievementDefinitionSchema = SchemaFactory.createForClass(AchievementDefinition);

// Index per spec Section 3.7
AchievementDefinitionSchema.index({ code: 1 }, { unique: true });
