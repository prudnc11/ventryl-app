import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../schemas/user.schema';
import { Request } from 'express';
import * as crypto from 'crypto';

function extractFromCookieOrHeader(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Try access_token header
  if (req.headers['access_token']) {
    return req.headers['access_token'] as string;
  }
  // Try cookie
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookieOrHeader]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: { sub: string; sid: string }) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('-password')
      .lean();

    if (!user || user.is_deleted || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Timing-safe session token validation
    if (user.session_token && payload.sid) {
      const storedBuf = Buffer.from(user.session_token);
      const payloadBuf = Buffer.from(payload.sid);
      if (
        storedBuf.length !== payloadBuf.length ||
        !crypto.timingSafeEqual(storedBuf, payloadBuf)
      ) {
        throw new UnauthorizedException('Session expired');
      }
    }

    return user;
  }
}
