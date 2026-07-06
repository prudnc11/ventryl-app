import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { SkipAuth } from './shared/decorators/skip-auth.decorator';

@Controller()
class AppController {
  @SkipAuth()
  @Get()
  health() {
    return { status: 'ok', service: 'Ventryl API', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    AuthModule,
    WalletModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    // Global JWT guard — all routes protected by default
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
