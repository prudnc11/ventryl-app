import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum WalletCurrency {
  NGN = 'NGN',
  USD = 'USD',
  USDC = 'USDC',
}

@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  created_by: Types.ObjectId;

  @Prop({ enum: WalletCurrency, default: WalletCurrency.NGN })
  currency: WalletCurrency;

  @Prop({ default: 0 })
  available_balance: number;

  @Prop({ default: 0 })
  ledger_balance: number;

  @Prop({ default: false })
  is_activated: boolean;

  // Kredibank NUBAN details
  @Prop()
  nuban: string;

  @Prop()
  account_name: string;

  @Prop()
  kredi_id: string;

  @Prop({ enum: ['PENDING', 'ACTIVE', 'FAILED'], default: 'PENDING' })
  nuban_status: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// One wallet per user per currency
WalletSchema.index({ user: 1, currency: 1 }, { unique: true });
