import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  HttpCode,
} from '@nestjs/common';
import { SkipAuth } from '../shared/decorators/skip-auth.decorator';
import { WalletService } from '../wallet/wallet.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private walletService: WalletService) {}

  @Post('kredi/:type')
  @SkipAuth()
  @HttpCode(200)
  async handleKrediWebhook(
    @Headers('signature-key') signature: string,
    @Body() body: any,
    @Param('type') type: 'payin' | 'payout',
  ) {
    if (type === 'payin') {
      return this.walletService.handlePayinWebhook(body, signature);
    }
    if (type === 'payout') {
      return this.walletService.handlePayoutWebhook(body, signature);
    }
    return { received: true, processed: false, reason: 'unknown type' };
  }
}
