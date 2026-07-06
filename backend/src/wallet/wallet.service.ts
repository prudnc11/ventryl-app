import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { Wallet, WalletCurrency } from '../schemas/wallet.schema';
import { Transaction, TransactionType, TransactionStatus, TransactionSource } from '../schemas/transaction.schema';
import { BankDetails } from '../schemas/bank-details.schema';
import { User } from '../schemas/user.schema';
import { KredibankService } from '../providers/kredibank';
import {
  ActivateWalletDto,
  AddBankAccountDto,
  WithdrawDto,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<any>,
    @InjectModel(Transaction.name) private transactionModel: Model<any>,
    @InjectModel(BankDetails.name) private bankDetailsModel: Model<any>,
    @InjectModel(User.name) private userModel: Model<any>,
    private kredibankService: KredibankService,
  ) {}

  // ── Wallet balance ───────────────────────────────────────────────────────
  async getBalance(userId: string) {
    let wallet = await this.walletModel.findOne({
      user: new Types.ObjectId(userId),
      currency: WalletCurrency.NGN,
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        user: userId,
        created_by: userId,
        currency: WalletCurrency.NGN,
        available_balance: 0,
        ledger_balance: 0,
        is_activated: false,
      });
    }

    return {
      _id: wallet._id,
      currency: wallet.currency,
      available_balance: wallet.available_balance,
      ledger_balance: wallet.ledger_balance,
      is_activated: wallet.is_activated,
      nuban: wallet.nuban,
      account_name: wallet.account_name,
      nuban_status: wallet.nuban_status,
    };
  }

  // ── Activate wallet (BVN/NIN → Kredibank NUBAN) ─────────────────────────
  async activateWallet(userId: string, dto: ActivateWalletDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found.');

    let wallet = await this.walletModel.findOne({
      user: new Types.ObjectId(userId),
      currency: WalletCurrency.NGN,
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        user: userId,
        created_by: userId,
        currency: WalletCurrency.NGN,
        available_balance: 0,
        ledger_balance: 0,
        is_activated: false,
      });
    }

    if (wallet.is_activated) {
      throw new BadRequestException('Wallet is already activated.');
    }

    wallet.is_activated = true;
    wallet.nuban_status = 'PENDING';
    await wallet.save();

    // Fire-and-forget NUBAN generation via Kredibank
    this.generateNuban(wallet, user, dto).catch((err) => {
      console.error('[NUBAN] Generation failed:', err.message);
    });

    return { message: 'Wallet activated. NUBAN generation in progress.' };
  }

  private async generateNuban(wallet: any, user: any, dto: ActivateWalletDto) {
    try {
      const kredi = await this.kredibankService.createSubMerchant({
        organisation_name: user.company_name || `${user.first_name} ${user.last_name}`,
        phone_no: user.phone_number,
        email: user.email,
        address: user.state || 'Lagos',
        rc_number: user.rc_number || '',
        bvn: dto.bvn,
      });

      await this.walletModel.updateOne(
        { _id: wallet._id },
        {
          kredi_id: kredi.id,
          nuban: kredi.nuban,
          nuban_status: 'ACTIVE',
          account_name: user.company_name || `${user.first_name} ${user.last_name}`,
          metadata: { kredi_response: kredi },
        },
      );
    } catch (err: any) {
      await this.walletModel.updateOne(
        { _id: wallet._id },
        {
          nuban_status: 'FAILED',
          metadata: { kredi_error: err.message },
        },
      );
    }
  }

  // ── Fund wallet (atomic credit) ──────────────────────────────────────────
  async creditWallet(
    userId: string,
    amount: number,
    description: string,
    reference: string,
    source: TransactionSource = TransactionSource.INTERNAL,
  ) {
    // Atomic balance update
    const wallet = await this.walletModel.findOneAndUpdate(
      { user: new Types.ObjectId(userId), currency: WalletCurrency.NGN },
      { $inc: { available_balance: amount, ledger_balance: amount } },
      { new: true },
    );

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    await this.transactionModel.create({
      user: userId,
      wallet: wallet._id,
      amount,
      balance: wallet.available_balance,
      currency: WalletCurrency.NGN,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      reference,
      description,
      source,
      processed_at: new Date(),
      initiated_by: userId,
      initiated_at: new Date(),
    });

    return {
      message: 'Wallet credited successfully.',
      balance: wallet.available_balance,
    };
  }

  // ── Hold funds (for order placement) — atomic ────────────────────────────
  async holdFunds(userId: string, amount: number, orderId: string) {
    const result = await this.walletModel.findOneAndUpdate(
      {
        user: new Types.ObjectId(userId),
        currency: WalletCurrency.NGN,
        available_balance: { $gte: amount },
      },
      { $inc: { available_balance: -amount } },
      { new: true },
    );

    if (!result) {
      throw new BadRequestException('Insufficient balance.');
    }

    await this.transactionModel.create({
      user: userId,
      wallet: result._id,
      amount,
      balance: result.available_balance,
      currency: WalletCurrency.NGN,
      type: TransactionType.PAYMENT,
      status: TransactionStatus.PENDING,
      reference: `HOLD-${orderId}-${Date.now().toString(36)}`,
      description: `Funds held for order ${orderId}`,
      session_id: orderId,
      initiated_by: userId,
      initiated_at: new Date(),
    });

    return { message: 'Funds held.', balance: result.available_balance };
  }

  // ── Release held funds (order delivered → pay depot) ─────────────────────
  async releaseAndPay(orderId: string, depotUserId: string, amount: number) {
    const holdTxn = await this.transactionModel.findOne({
      session_id: orderId,
      type: TransactionType.PAYMENT,
      status: TransactionStatus.PENDING,
    });

    if (!holdTxn) {
      throw new BadRequestException('No held funds found for this order.');
    }

    // Settle the hold
    await this.transactionModel.updateOne(
      { _id: holdTxn._id },
      { status: TransactionStatus.COMPLETED, processed_at: new Date() },
    );

    // Deduct from buyer ledger
    await this.walletModel.updateOne(
      { user: holdTxn.user, currency: WalletCurrency.NGN },
      { $inc: { ledger_balance: -amount } },
    );

    // Credit depot owner (upsert wallet if needed)
    const depotWallet = await this.walletModel.findOneAndUpdate(
      { user: new Types.ObjectId(depotUserId), currency: WalletCurrency.NGN },
      {
        $inc: { available_balance: amount, ledger_balance: amount },
        $setOnInsert: { created_by: depotUserId, is_activated: false },
      },
      { new: true, upsert: true },
    );

    await this.transactionModel.create({
      user: depotUserId,
      wallet: depotWallet._id,
      amount,
      balance: depotWallet.available_balance,
      currency: WalletCurrency.NGN,
      type: TransactionType.DISBURSEMENT,
      status: TransactionStatus.COMPLETED,
      reference: `DISB-${orderId}-${Date.now().toString(36)}`,
      description: `Payment for order ${orderId}`,
      session_id: orderId,
      processed_at: new Date(),
      initiated_by: 'SYSTEM',
      initiated_at: new Date(),
    });

    return { message: 'Funds released and depot paid.' };
  }

  // ── Refund held funds (order cancelled) ──────────────────────────────────
  async refundHold(userId: string, orderId: string, amount: number, reason: string) {
    // Restore available balance atomically
    const wallet = await this.walletModel.findOneAndUpdate(
      { user: new Types.ObjectId(userId), currency: WalletCurrency.NGN },
      { $inc: { available_balance: amount } },
      { new: true },
    );

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    // Mark hold as cancelled
    await this.transactionModel.updateOne(
      { session_id: orderId, type: TransactionType.PAYMENT, status: TransactionStatus.PENDING },
      { status: TransactionStatus.CANCELLED, processed_at: new Date() },
    );

    // Record refund
    await this.transactionModel.create({
      user: userId,
      wallet: wallet._id,
      amount,
      balance: wallet.available_balance,
      currency: WalletCurrency.NGN,
      type: TransactionType.REFUND,
      status: TransactionStatus.COMPLETED,
      reference: `REF-${orderId}-${Date.now().toString(36)}`,
      description: reason || `Refund for cancelled order ${orderId}`,
      session_id: orderId,
      processed_at: new Date(),
      initiated_by: 'SYSTEM',
      initiated_at: new Date(),
    });

    return { message: 'Funds refunded.', balance: wallet.available_balance };
  }

  // ── Withdraw to bank account — atomic debit ──────────────────────────────
  async withdraw(userId: string, dto: WithdrawDto) {
    const bankAccount = await this.bankDetailsModel.findOne({
      _id: dto.bank_account_id,
      user: new Types.ObjectId(userId),
      is_deleted: false,
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found.');

    // Atomic debit — only succeeds if balance >= amount AND wallet is activated
    const wallet = await this.walletModel.findOneAndUpdate(
      {
        user: new Types.ObjectId(userId),
        currency: WalletCurrency.NGN,
        available_balance: { $gte: dto.amount },
        is_activated: true,
      },
      { $inc: { available_balance: -dto.amount, ledger_balance: -dto.amount } },
      { new: true },
    );

    if (!wallet) {
      throw new BadRequestException('Insufficient balance or wallet not activated.');
    }

    const reference = `WD-${uuidv4().split('-')[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const txn = await this.transactionModel.create({
      user: userId,
      wallet: wallet._id,
      amount: dto.amount,
      balance: wallet.available_balance,
      currency: WalletCurrency.NGN,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      reference,
      description: dto.narration || 'Withdrawal to bank account',
      source: TransactionSource.KREDI_BANK,
      initiated_by: userId,
      initiated_at: new Date(),
      metadata: {
        bank_account_id: String(bankAccount._id),
        account_number: bankAccount.account_number,
        bank_code: bankAccount.bank_code,
        bank_name: bankAccount.bank_name,
      },
    });

    // Fire-and-forget payout via Kredibank
    this.processPayoutAsync(txn, bankAccount).catch((err) => {
      console.error('[PAYOUT] Failed:', err.message);
    });

    return {
      message: 'Withdrawal initiated.',
      reference,
      balance: wallet.available_balance,
    };
  }

  private async processPayoutAsync(txn: any, bankAccount: any) {
    try {
      const result = await this.kredibankService.initiatePayout({
        amount: txn.amount,
        beneficiaryAccountNumber: bankAccount.account_number,
        beneficiaryBankCode: bankAccount.bank_code,
        beneficiaryName: bankAccount.account_name || '',
        narration: txn.description,
        reference: txn.reference,
      });

      await this.transactionModel.updateOne(
        { _id: txn._id },
        {
          status: TransactionStatus.COMPLETED,
          processed_at: new Date(),
          metadata: { ...txn.metadata, payout_response: result },
        },
      );
    } catch (err: any) {
      // Payout failed — reverse the debit
      await this.walletModel.updateOne(
        { _id: txn.wallet },
        { $inc: { available_balance: txn.amount, ledger_balance: txn.amount } },
      );
      await this.transactionModel.updateOne(
        { _id: txn._id },
        {
          status: TransactionStatus.FAILED,
          metadata: { ...txn.metadata, payout_error: err.message },
        },
      );
    }
  }

  // ── Transaction history ──────────────────────────────────────────────────
  async getTransactions(
    userId: string,
    query: { page?: number; limit?: number; type?: string; status?: string },
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { user: new Types.ObjectId(userId) };
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(filter),
    ]);

    return {
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getTransactionByReference(reference: string) {
    const txn = await this.transactionModel.findOne({ reference }).lean();
    if (!txn) throw new NotFoundException('Transaction not found.');
    return txn;
  }

  // ── Bank accounts ────────────────────────────────────────────────────────
  async addBankAccount(userId: string, dto: AddBankAccountDto) {
    const existing = await this.bankDetailsModel.findOne({
      user: new Types.ObjectId(userId),
      account_number: dto.account_number,
      bank_code: dto.bank_code,
      is_deleted: false,
    });
    if (existing) throw new BadRequestException('Bank account already added.');

    let accountName = '';
    try {
      const verified = await this.kredibankService.verifyBeneficiary(
        dto.account_number,
        dto.bank_code,
      );
      accountName = verified.accountName || '';
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Could not verify bank account.');
      }
    }

    const isFirst = (await this.bankDetailsModel.countDocuments({
      user: new Types.ObjectId(userId),
      is_deleted: false,
    })) === 0;

    const account = await this.bankDetailsModel.create({
      user: userId,
      account_number: dto.account_number,
      bank_code: dto.bank_code,
      bank_name: dto.bank_name || '',
      account_name: accountName,
      is_verified: !!accountName,
      is_default: isFirst,
    });

    return { message: 'Bank account added.', account };
  }

  async listBankAccounts(userId: string) {
    return this.bankDetailsModel
      .find({ user: new Types.ObjectId(userId), is_deleted: false })
      .lean();
  }

  async removeBankAccount(userId: string, bankId: string) {
    const account = await this.bankDetailsModel.findOneAndUpdate(
      { _id: bankId, user: new Types.ObjectId(userId), is_deleted: false },
      { is_deleted: true },
      { new: true },
    );
    if (!account) throw new NotFoundException('Bank account not found.');
    return { message: 'Bank account removed.' };
  }

  async setDefaultBankAccount(userId: string, bankId: string) {
    await this.bankDetailsModel.updateMany(
      { user: new Types.ObjectId(userId) },
      { is_default: false },
    );

    const account = await this.bankDetailsModel.findOneAndUpdate(
      { _id: bankId, user: new Types.ObjectId(userId), is_deleted: false },
      { is_default: true },
      { new: true },
    );
    if (!account) throw new NotFoundException('Bank account not found.');
    return { message: 'Default bank account updated.' };
  }

  // ── Banks list (public) ──────────────────────────────────────────────────
  async getBanks() {
    return this.kredibankService.fetchBankList();
  }

  // ── Webhook: Kredibank payin ─────────────────────────────────────────────
  async handlePayinWebhook(body: any, signature: string) {
    const { amount, remit_reference, account_number } = body;

    if (!this.kredibankService.verifySignature(amount, remit_reference, signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    const wallet = await this.walletModel.findOne({ nuban: account_number });
    if (!wallet) {
      console.error('[WEBHOOK] No wallet found for NUBAN:', account_number);
      return { received: true, processed: false };
    }

    const existing = await this.transactionModel.findOne({ reference: remit_reference });
    if (existing) {
      return { received: true, processed: false, reason: 'duplicate' };
    }

    await this.creditWallet(
      String(wallet.user),
      Number(amount),
      'Deposit via bank transfer',
      remit_reference,
      TransactionSource.KREDI_BANK,
    );

    return { received: true, processed: true };
  }

  // ── Webhook: Kredibank payout status ─────────────────────────────────────
  async handlePayoutWebhook(body: any, signature: string) {
    const { reference, status, amount } = body;

    if (!this.kredibankService.verifySignature(amount, reference, signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    const txn = await this.transactionModel.findOne({ reference });
    if (!txn) return { received: true, processed: false };

    if (status === 'Success') {
      txn.status = TransactionStatus.COMPLETED;
      txn.processed_at = new Date();
    } else {
      txn.status = TransactionStatus.FAILED;
      await this.walletModel.updateOne(
        { _id: txn.wallet },
        { $inc: { available_balance: txn.amount, ledger_balance: txn.amount } },
      );
    }

    await txn.save();
    return { received: true, processed: true };
  }
}
