import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class KredibankService {
  private readonly baseUrl: string;
  private readonly baseUrlV2: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly client: AxiosInstance;

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get('KREDI_BASE_URL') || '';
    this.baseUrlV2 = this.config.get('KREDI_BASE_URL_V2') || '';
    this.apiKey = this.config.get('KREDI_API_KEY') || '';
    this.secretKey = this.config.get('KREDI_SECRET_KEY') || '';
    this.webhookSecret = this.config.get('KREDI_WEBHOOK_SECRET') || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: this.getHeaders(),
      timeout: 20000,
    });
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'x-api-key': this.apiKey,
    };
  }

  /** Verify webhook signature (timing-safe) */
  verifySignature(amount: number | string, remitReference: string, signature: string): boolean {
    if (!signature || !this.webhookSecret) return false;

    const raw = `${String(amount).trim()}-${this.webhookSecret}-${remitReference.trim()}`;
    const expected = createHash('sha512').update(raw).digest('hex');

    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /** Create sub-merchant and get NUBAN */
  async createSubMerchant(payload: {
    organisation_name: string;
    phone_no: string;
    email: string;
    address: string;
    rc_number: string;
    bvn: string;
  }): Promise<{ id: string; nuban: string }> {
    const response = await this.client.post('/api/v2/businesses/create', payload);

    if (response.data.status !== 200) {
      throw new HttpException(
        response.data.message || 'Failed to create sub-merchant',
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data.data;
  }

  /** Verify beneficiary account for payouts */
  async verifyBeneficiary(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string; accountNumber: string }> {
    const response = await axios.get(`${this.baseUrlV2}/api/kredipay/nameenquiry`, {
      headers: this.getHeaders(),
      params: { accountNo: accountNumber, bankCode },
    });

    if (response.data.status !== 'Success') {
      throw new HttpException(
        response.data.message || 'Beneficiary verification failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data.data;
  }

  /** Initiate payout (withdrawal) */
  async initiatePayout(payload: {
    amount: number;
    beneficiaryAccountNumber: string;
    beneficiaryBankCode: string;
    beneficiaryName: string;
    narration: string;
    reference: string;
  }): Promise<{ transactionReference: string; status: string }> {
    const response = await axios.post(
      `${this.baseUrlV2}/api/kredipay/fundtransfer`,
      payload,
      { headers: this.getHeaders() },
    );

    if (response.data.status !== 'Success') {
      throw new HttpException(
        response.data.message || 'Payout initiation failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data.data;
  }

  /** Get payout transaction status */
  async getPayoutStatus(transactionRef: string): Promise<{ responseMessage: string }> {
    const response = await this.client.get('/api/kredipay/transaction_status', {
      params: { transactionRef },
    });

    return response.data.data;
  }

  /** Fetch Nigerian bank list */
  async fetchBankList(): Promise<any[]> {
    const response = await this.client.get('/api/v2/banks');
    if (!response.data.status) {
      throw new HttpException('Failed to fetch bank list', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return response.data.data;
  }
}
