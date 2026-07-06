import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet, WalletSchema } from '../schemas/wallet.schema';
import { Transaction, TransactionSchema } from '../schemas/transaction.schema';
import { BankDetails, BankDetailsSchema } from '../schemas/bank-details.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { KredibankService } from '../providers/kredibank';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: BankDetails.name, schema: BankDetailsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService, KredibankService],
  exports: [WalletService],
})
export class WalletModule {}
