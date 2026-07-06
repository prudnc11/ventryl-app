import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Res,
  Req,
  Query,
  Param,
} from '@nestjs/common';
import * as express from 'express';
import { AuthService } from './auth.service';
import {
  SignupDto,
  LoginDto,
  ConfirmOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  Complete2faDto,
  Setup2faAppDto,
} from './dto/auth.dto';
import { SkipAuth } from '../shared/decorators/skip-auth.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { setAuthCookies, clearAuthCookies } from '../shared/utils/cookie';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Public routes ───────────────────────────────────────────────────────

  @SkipAuth()
  @Post('join')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @SkipAuth()
  @Post('verification/confirm')
  async confirmOtp(@Body() dto: ConfirmOtpDto, @Res() res: express.Response) {
    const result = await this.authService.confirmOtp(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json({
      message: 'Email verified successfully.',
      user: result.user,
    });
  }

  @SkipAuth()
  @Get('verification/resend')
  async resendOtp(@Query('email') email: string) {
    return this.authService.resendOtp(email);
  }

  @SkipAuth()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: express.Response) {
    const result = await this.authService.login(dto);

    if ('requires_2fa' in result) {
      return res.json(result);
    }

    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json({ message: 'Login successful.', user: result.user });
  }

  @SkipAuth()
  @Post('two-factor-auth/complete-login')
  async complete2fa(@Body() dto: Complete2faDto, @Res() res: express.Response) {
    const result = await this.authService.complete2faLogin(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json({ message: 'Login successful.', user: result.user });
  }

  @SkipAuth()
  @Post('refresh-token')
  async refreshToken(@Req() req: express.Request, @Res() res: express.Response) {
    const token =
      req.cookies?.refresh_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : req.headers['refresh_token']);

    if (!token) {
      return res.status(401).json({ message: 'No refresh token provided.' });
    }

    const result = await this.authService.refreshTokens(token);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json({ message: 'Tokens refreshed.' });
  }

  @SkipAuth()
  @Post('password/forgot')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @SkipAuth()
  @Put('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ── Protected routes ────────────────────────────────────────────────────

  @Delete('logout')
  async logout(@Res() res: express.Response) {
    clearAuthCookies(res);
    return res.json({ message: 'Logged out.' });
  }

  @Get('user/info')
  async getUserInfo(@CurrentUser('_id') userId: string) {
    return this.authService.getUserInfo(userId);
  }

  @Put('user/update')
  async updateProfile(
    @CurrentUser('_id') userId: string,
    @Body() body: Partial<{ first_name: string; last_name: string; phone_number: string; company_name: string; state: string; lga: string }>,
  ) {
    return this.authService.updateProfile(userId, body);
  }

  @Put('password/change')
  async changePassword(
    @CurrentUser('_id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  // ── 2FA: App (TOTP) ────────────────────────────────────────────────────

  @Post('2fa/app/setup')
  async setup2faApp(@CurrentUser('_id') userId: string) {
    return this.authService.setup2faApp(userId);
  }

  @Post('2fa/app/confirm')
  async confirm2faApp(
    @CurrentUser('_id') userId: string,
    @Body() dto: Setup2faAppDto,
  ) {
    return this.authService.confirm2faApp(userId, dto.code);
  }

  @Post('2fa/app/disable')
  async disable2faApp(
    @CurrentUser('_id') userId: string,
    @Body() dto: Setup2faAppDto,
  ) {
    return this.authService.disable2faApp(userId, dto.code);
  }

  // ── 2FA: Email / SMS ───────────────────────────────────────────────────

  @Post('2fa/:method/send')
  async send2faCode(
    @CurrentUser('_id') userId: string,
    @Param('method') method: string,
  ) {
    const m = method.toUpperCase() as 'EMAIL' | 'SMS';
    return this.authService.send2faCode(userId, m);
  }

  @Post('2fa/:method/confirm')
  async confirm2faChannel(
    @CurrentUser('_id') userId: string,
    @Param('method') method: string,
    @Body('code') code: string,
  ) {
    const m = method.toUpperCase() as 'EMAIL' | 'SMS';
    return this.authService.confirm2faChannel(userId, m, code);
  }
}
