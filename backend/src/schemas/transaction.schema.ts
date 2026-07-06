import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TransactionType {
  PAYMENT = 'PAYMENT',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  DISBURSEMENT = 'DISBURSEMENT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionSource {
  INTERNAL = 'INTERNAL',
  KREDI_BANK = 'KREDI_BANK',
}

@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true })
  wallet: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  balance: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({ enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop({ required: true, unique: true })
  reference: string;

  @Prop()
  description: string;

  @Prop()
  processed_at: Date;

  @Prop()
  initiated_by: string;

  @Prop()
  initiated_at: Date;

  @Prop({ enum: TransactionSource, default: TransactionSource.INTERNAL })
  source: TransactionSource;

  @Prop()
  session_id: string; // order_id or kredibank session

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  transaction_code: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Auto-generate transaction code
TransactionSchema.pre('save', function () {
  if (!this.transaction_code) {
    this.transaction_code = `TXN-${Date.now().toString(36).toUpperCase()}`;
  }
});

TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ reference: 1 }, { unique: true });
TransactionSchema.index({ session_id: 1 });
