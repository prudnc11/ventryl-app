import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  BUSINESS = 'BUSINESS',
  ADMIN = 'ADMIN',
}

@Schema({ timestamps: true, collection: 'users' })
export class User extends Document {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone_number: string;

  @Prop({ required: true, trim: true })
  first_name: string;

  @Prop({ required: true, trim: true })
  last_name: string;

  @Prop({ trim: true })
  company_name: string;

  @Prop({ trim: true })
  rc_number: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop({ default: false })
  is_deleted: boolean;

  @Prop({ type: String, enum: UserRole, default: UserRole.CUSTOMER })
  type: UserRole;

  @Prop()
  profile_picture: string;

  @Prop()
  session_token: string;

  @Prop()
  last_login: Date;

  @Prop()
  state: string;

  @Prop()
  lga: string;

  // KYC
  @Prop({ default: 'pending' })
  kyc_status: string;

  // 2FA settings
  @Prop({ default: false })
  two_factor_email_enabled: boolean;

  @Prop({ default: false })
  two_factor_sms_enabled: boolean;

  @Prop({ default: false })
  two_factor_app_enabled: boolean;

  @Prop()
  totp_secret: string;

  // Role-based access
  @Prop({ type: Types.ObjectId, ref: 'Role' })
  role: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: false })
  is_super_admin: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Hash password before save
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// email uniqueness enforced by @Prop({ unique: true }) above
