import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type XpEventDocument = HydratedDocument<XpEvent>;

@Schema({ collection: 'xp_events' })
export class XpEvent {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  delta!: number;

  @Prop({ required: true, enum: ['habit_complete', 'habit_undo', 'achievement_unlock'] })
  source!: 'habit_complete' | 'habit_undo' | 'achievement_unlock';

  @Prop({ required: true })
  contextType!: string;

  @Prop({ required: true, type: Types.ObjectId })
  contextId!: Types.ObjectId;

  @Prop({ required: true })
  balanceBefore!: number;

  @Prop({ required: true })
  balanceAfter!: number;

  @Prop({ required: true, default: () => new Date() })
  timestamp!: Date;
}

export const XpEventSchema = SchemaFactory.createForClass(XpEvent);

XpEventSchema.index({ userId: 1, timestamp: -1 });
