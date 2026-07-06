import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { SkipAuth } from '../shared/decorators/skip-auth.decorator';
import {
  ActivateWalletDto,
  AddBankAccountDto,
  WithdrawDto,
} from './dto/wallet.dto';

@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  // ── Wallet balance ───────────────────────────────────────────────────────

  @Get('balance')
  getBalance(@CurrentUser('_id') userId: string) {
    return this.walletService.getBalance(userId);
  }

  @Post('activate')
  activateWallet(
    @CurrentUser('_id') userId: string,
    @Body() dto: ActivateWalletDto,
  ) {
    return this.walletService.activateWallet(userId, dto);
  }

  // ── Transactions ─────────────────────────────────────────────────────────

  @Get('transactions')
  getTransactions(
    @CurrentUser('_id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.walletService.getTransactions(userId, { page, limit, type, status });
  }

  @Get('transactions/:reference')
  getTransactionByReference(@Param('reference') reference: string) {
    return this.walletService.getTransactionByReference(reference);
  }

  // ── Withdrawals ──────────────────────────────────────────────────────────

  @Post('withdraw')
  withdraw(
    @CurrentUser('_id') userId: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.walletService.withdraw(userId, dto);
  }

  // ── Bank accounts ────────────────────────────────────────────────────────

  @Get('bank-accounts')
  listBankAccounts(@CurrentUser('_id') userId: string) {
    return this.walletService.listBankAccounts(userId);
  }

  @Post('bank-accounts')
  addBankAccount(
    @CurrentUser('_id') userId: string,
    @Body() dto: AddBankAccountDto,
  ) {
    return this.walletService.addBankAccount(userId, dto);
  }

  @Delete('bank-accounts/:id')
  removeBankAccount(
    @CurrentUser('_id') userId: string,
    @Param('id') bankId: string,
  ) {
    return this.walletService.removeBankAccount(userId, bankId);
  }

  @Put('bank-accounts/:id/default')
  setDefaultBankAccount(
    @CurrentUser('_id') userId: string,
    @Param('id') bankId: string,
  ) {
    return this.walletService.setDefaultBankAccount(userId, bankId);
  }

  // ── Public: bank list ────────────────────────────────────────────────────

  @SkipAuth()
  @Get('banks')
  getBanks() {
    return this.walletService.getBanks();
  }
}
