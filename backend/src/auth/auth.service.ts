import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as otplib from 'otplib';
import qrcode from 'qrcode';

import { User } from '../schemas/user.schema';
import { VerificationCode } from '../schemas/verification-code.schema';
import { TokenService } from '../shared/services/token.service';
import {
  SignupDto,
  LoginDto,
  ConfirmOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  Complete2faDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(VerificationCode.name)
    private codeModel: Model<VerificationCode>,
    private tokenService: TokenService,
  ) {}

  // ── Signup ──────────────────────────────────────────────────────────────
  async signup(dto: SignupDto) {
    const existing = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
      is_deleted: false,
    });
    if (existing) {
      throw new ConflictException('This email is already registered.');
    }

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      password: dto.password,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone_number: dto.phone_number,
      company_name: dto.company_name || '',
      rc_number: dto.rc_number || '',
      state: dto.state || '',
      lga: dto.lga || '',
      is_verified: false,
    });

    // Generate and send OTP
    await this.sendVerificationCode(user.email, String(user._id));

    return {
      message: 'Account created. Please verify your email.',
      email: user.email,
    };
  }

  // ── Email verification ──────────────────────────────────────────────────
  async confirmOtp(dto: ConfirmOtpDto) {
    const code = await this.codeModel.findOne({
      email: dto.email.toLowerCase(),
      code: dto.code,
    });
    if (!code) {
      throw new BadRequestException('Invalid or expired verification code.');
    }
    if (code.expires_at < new Date()) {
      await this.codeModel.deleteOne({ _id: code._id });
      throw new BadRequestException('Verification code has expired.');
    }

    const user = await this.userModel.findOneAndUpdate(
      { email: dto.email.toLowerCase() },
      { is_verified: true },
      { new: true },
    );
    if (!user) throw new BadRequestException('User not found.');

    // Clean up code
    await this.codeModel.deleteMany({ email: dto.email.toLowerCase() });

    // Establish session
    return this.establishSession(user);
  }

  // ── Resend OTP ──────────────────────────────────────────────────────────
  async resendOtp(email: string) {
    const user = await this.userModel.findOne({
      email: email.toLowerCase(),
      is_deleted: false,
    });
    if (!user) throw new BadRequestException('User not found.');
    if (user.is_verified)
      throw new BadRequestException('Email already verified.');

    await this.sendVerificationCode(user.email, String(user._id));
    return { message: 'Verification code sent.' };
  }

  // ── Login ───────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
      is_deleted: false,
    });
    if (!user) throw new UnauthorizedException('Invalid email or password.');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password.');

    if (!user.is_verified) {
      // Resend verification code
      await this.sendVerificationCode(user.email, String(user._id));
      throw new UnauthorizedException(
        'Email not verified. A new verification code has been sent.',
      );
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated.');
    }

    // Check 2FA
    const has2fa =
      user.two_factor_app_enabled ||
      user.two_factor_sms_enabled ||
      user.two_factor_email_enabled;

    if (has2fa) {
      const method = user.two_factor_app_enabled
        ? 'APP'
        : user.two_factor_sms_enabled
          ? 'SMS'
          : 'EMAIL';

      // Send 2FA code for SMS/EMAIL methods
      if (method !== 'APP') {
        await this.sendVerificationCode(user.email, String(user._id));
      }

      const challengeToken = this.tokenService.generate2faChallengeToken(
        String(user._id),
      );
      return {
        requires_2fa: true,
        method,
        challenge_token: challengeToken,
      };
    }

    // No 2FA — establish session directly
    return this.establishSession(user);
  }

  // ── Complete 2FA login ──────────────────────────────────────────────────
  async complete2faLogin(dto: Complete2faDto) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.tokenService.verify2faChallengeToken(dto.challenge_token);
    } catch {
      throw new UnauthorizedException(
        '2FA challenge expired. Please login again.',
      );
    }

    if (payload.purpose !== 'two_factor_pending') {
      throw new UnauthorizedException('Invalid challenge token.');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found.');

    // Validate 2FA code
    if (user.two_factor_app_enabled) {
      const isValid = otplib.verifySync({ token: dto.code, secret: user.totp_secret });
      if (!isValid) throw new UnauthorizedException('Invalid 2FA code.');
    } else {
      // SMS or EMAIL — verify code from DB
      const codeDoc = await this.codeModel.findOne({
        email: user.email,
        code: dto.code,
      });
      if (!codeDoc || codeDoc.expires_at < new Date()) {
        throw new UnauthorizedException('Invalid or expired 2FA code.');
      }
      await this.codeModel.deleteMany({ email: user.email });
    }

    return this.establishSession(user);
  }

  // ── Token refresh ───────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; sid: string };
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.is_active || user.is_deleted) {
      throw new UnauthorizedException('User not found or inactive.');
    }

    // Validate session
    if (user.session_token !== payload.sid) {
      throw new UnauthorizedException('Session expired.');
    }

    return this.tokenService.generateTokenPair(
      String(user._id),
      user.session_token,
    );
  }

  // ── Forgot password ────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
      is_deleted: false,
    });
    if (user) {
      await this.sendVerificationCode(user.email, String(user._id));
    }
    // Always return success (don't reveal if email exists)
    return { message: 'If the email exists, a reset code has been sent.' };
  }

  // ── Reset password ─────────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const codeDoc = await this.codeModel.findOne({
      email: dto.email.toLowerCase(),
      code: dto.code,
    });
    if (!codeDoc || codeDoc.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired reset code.');
    }

    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (!user) throw new BadRequestException('User not found.');

    user.password = dto.new_password; // hashed by pre-save hook
    await user.save();

    await this.codeModel.deleteMany({ email: dto.email.toLowerCase() });
    return { message: 'Password has been reset successfully.' };
  }

  // ── Change password (authenticated) ─────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found.');

    const isMatch = await bcrypt.compare(dto.current_password, user.password);
    if (!isMatch) throw new BadRequestException('Current password is incorrect.');

    user.password = dto.new_password; // hashed by pre-save hook
    await user.save();
    return { message: 'Password updated successfully.' };
  }

  // ── Get current user ───────────────────────────────────────────────────
  async getUserInfo(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -session_token -totp_secret')
      .lean();
    if (!user) throw new BadRequestException('User not found.');
    return user;
  }

  // ── Update profile ─────────────────────────────────────────────────────
  async updateProfile(
    userId: string,
    patch: Partial<{
      first_name: string;
      last_name: string;
      phone_number: string;
      company_name: string;
      state: string;
      lga: string;
    }>,
  ) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, patch, { new: true })
      .select('-password -session_token -totp_secret')
      .lean();
    return user;
  }

  // ── 2FA: App (TOTP) setup ──────────────────────────────────────────────
  async setup2faApp(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found.');

    const secret = otplib.generateSecret();
    const otpauthUrl = otplib.generateURI({ issuer: 'Ventryl', label: user.email, secret });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    // Store secret (not yet enabled)
    await this.userModel.updateOne(
      { _id: userId },
      { totp_secret: secret },
    );

    return { qr_code: qrCodeDataUrl, secret };
  }

  async confirm2faApp(userId: string, code: string) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.totp_secret) {
      throw new BadRequestException('2FA app not set up.');
    }

    const isValid = otplib.verifySync({ token: code, secret: user.totp_secret });
    if (!isValid) throw new BadRequestException('Invalid 2FA code.');

    await this.userModel.updateOne(
      { _id: userId },
      { two_factor_app_enabled: true },
    );
    return { message: '2FA app enabled successfully.' };
  }

  async disable2faApp(userId: string, code: string) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.two_factor_app_enabled) {
      throw new BadRequestException('2FA app not enabled.');
    }

    const isValid = otplib.verifySync({ token: code, secret: user.totp_secret });
    if (!isValid) throw new BadRequestException('Invalid 2FA code.');

    await this.userModel.updateOne(
      { _id: userId },
      { two_factor_app_enabled: false, totp_secret: null },
    );
    return { message: '2FA app disabled.' };
  }

  // ── 2FA: Email/SMS ─────────────────────────────────────────────────────
  async send2faCode(userId: string, method: 'EMAIL' | 'SMS') {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found.');
    await this.sendVerificationCode(user.email, String(user._id));
    return { message: `Verification code sent via ${method}.` };
  }

  async confirm2faChannel(
    userId: string,
    method: 'EMAIL' | 'SMS',
    code: string,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found.');

    const codeDoc = await this.codeModel.findOne({
      email: user.email,
      code,
    });
    if (!codeDoc || codeDoc.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired code.');
    }
    await this.codeModel.deleteMany({ email: user.email });

    const field =
      method === 'EMAIL'
        ? 'two_factor_email_enabled'
        : 'two_factor_sms_enabled';
    await this.userModel.updateOne({ _id: userId }, { [field]: true });

    return { message: `2FA via ${method} enabled.` };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private async establishSession(user: any) {
    const sessionToken = this.tokenService.generateSessionToken();
    await this.userModel.updateOne(
      { _id: user._id },
      { session_token: sessionToken, last_login: new Date() },
    );
    const tokens = this.tokenService.generateTokenPair(
      user._id.toString(),
      sessionToken,
    );
    return {
      ...tokens,
      user: {
        _id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        type: user.type,
        is_verified: user.is_verified,
        kyc_status: user.kyc_status,
        two_factor_app_enabled: user.two_factor_app_enabled,
        two_factor_sms_enabled: user.two_factor_sms_enabled,
        two_factor_email_enabled: user.two_factor_email_enabled,
      },
    };
  }

  private async sendVerificationCode(email: string, userId: string) {
    // Delete existing codes for this email
    await this.codeModel.deleteMany({ email });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.codeModel.create({
      code,
      email,
      user: userId,
      type: 'EMAIL',
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // TODO: Send via email provider (Sendgrid/Mailgun)
    // For now, log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Verification code for ${email}: ${code}`);
    }

    return code;
  }
}
