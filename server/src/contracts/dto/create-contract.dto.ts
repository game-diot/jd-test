import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const CONTRACT_TYPES = ['PURCHASE', 'SALES', 'SERVICE', 'NDA'] as const;
export const SEAL_TYPES = ['OFFICIAL_SEAL', 'CONTRACT_SEAL', 'LEGAL_REP_SEAL'] as const;

export class ContractItemDto {
  @IsString()
  @IsNotEmpty({ message: '合同名称不能为空' })
  @MaxLength(50, { message: '合同名称不能超过 50 字' })
  contractName!: string;

  @IsIn(CONTRACT_TYPES, { message: '合同类型不合法' })
  contractType!: string;

  /** 规范化十进制字符串，如 "100.50"（后端二次校验） */
  @IsString()
  amount!: string;

  @IsString()
  @IsNotEmpty({ message: '签约相对方不能为空' })
  counterparty!: string;

  @IsIn(SEAL_TYPES, { message: '用印类型不合法' })
  sealType!: string;

  @IsString()
  @IsOptional()
  fileId?: string;
}

export class CreateContractDto {
  @IsString()
  @IsNotEmpty({ message: '申请原因不能为空' })
  @MaxLength(100, { message: '申请原因不能超过 100 字' })
  reason!: string;

  @IsIn(['NORMAL', 'URGENT'])
  urgency!: string;

  @IsArray()
  @ArrayMinSize(1, { message: '至少一条合同明细' })
  @ValidateNested({ each: true })
  @Type(() => ContractItemDto)
  items!: ContractItemDto[];
}