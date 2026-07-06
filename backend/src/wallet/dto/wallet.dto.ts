import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ActivateWalletDto {
  @IsString()
  @IsNotEmpty({ message: 'BVN is required' })
  @MaxLength(11, { message: 'BVN must not exceed 11 characters' })
  bvn: string;

  @IsString()
  @IsNotEmpty({ message: 'NIN is required' })
  @MaxLength(11, { message: 'NIN must not exceed 11 characters' })
  nin: string;
}

export class WithdrawDto {
  @IsNotEmpty({ message: 'Amount is required' })
  @Min(100, { message: 'Minimum withdrawal amount is ₦100' })
  amount: number;

  @IsNotEmpty({ message: 'Bank account is required' })
  @IsMongoId()
  bank_account_id: string;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class AddBankAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Account number is required' })
  @MinLength(10)
  @MaxLength(10)
  account_number: string;

  @IsString()
  @IsNotEmpty({ message: 'Bank code is required' })
  bank_code: string;

  @IsOptional()
  @IsString()
  bank_name?: string;
}

export class FundWalletDto {
  @IsNotEmpty({ message: 'Amount is required' })
  @Min(100, { message: 'Minimum deposit is ₦100' })
  amount: number;
}
