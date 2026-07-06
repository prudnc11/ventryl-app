import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
