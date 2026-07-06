import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'verification_codes' })
export class VerificationCode extends Document {
  @Prop({ required: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: Types.ObjectId;

  @Prop({ required: true, lowercase: true })
  email: string;

  @Prop({ enum: ['SMS', 'EMAIL'], default: 'EMAIL' })
  type: string;

  @Prop({ required: true })
  expires_at: Date;
}

export const VerificationCodeSchema =
  SchemaFactory.createForClass(VerificationCode);

// Auto-delete expired codes
VerificationCodeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
VerificationCodeSchema.index({ email: 1, code: 1 });
