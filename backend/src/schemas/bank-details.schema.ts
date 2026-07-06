import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'bank_details' })
export class BankDetails extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  account_number: string;

  @Prop({ required: true })
  bank_code: string;

  @Prop()
  bank_name: string;

  @Prop()
  account_name: string;

  @Prop({ default: false })
  is_default: boolean;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop({ default: false })
  is_deleted: boolean;
}

export const BankDetailsSchema = SchemaFactory.createForClass(BankDetails);

BankDetailsSchema.index({ user: 1, account_number: 1, bank_code: 1 }, { unique: true });
