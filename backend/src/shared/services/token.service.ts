import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  generateSessionToken(): string {
    return uuidv4();
  }

  generateAccessToken(userId: string, sessionToken: string): string {
    return this.jwtService.sign(
      { sub: userId, sid: sessionToken },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '1d',
      },
    );
  }

  generateRefreshToken(userId: string, sessionToken: string): string {
    return this.jwtService.sign(
      { sub: userId, sid: sessionToken },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
  }

  generate2faChallengeToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'two_factor_pending' },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '10m',
      },
    );
  }

  verify2faChallengeToken(token: string): { sub: string; purpose: string } {
    return this.jwtService.verify(token, {
      secret: this.config.get('JWT_SECRET'),
    });
  }

  verifyRefreshToken(token: string): { sub: string; sid: string } {
    return this.jwtService.verify(token, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });
  }

  generateTokenPair(userId: string, sessionToken: string) {
    return {
      accessToken: this.generateAccessToken(userId, sessionToken),
      refreshToken: this.generateRefreshToken(userId, sessionToken),
      sessionToken,
    };
  }
}
