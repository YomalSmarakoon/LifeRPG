import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'refresh_sessions' })
export class RefreshSession {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true })
  familyId!: string;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  revoked!: boolean;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);

// Indexes per spec Section 3.2
RefreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
RefreshSessionSchema.index({ userId: 1, revoked: 1 });
RefreshSessionSchema.index({ familyId: 1 });
// TTL — MongoDB auto-deletes documents whose expiresAt has passed
RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
