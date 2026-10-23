import { IsString, MinLength } from 'class-validator';

export class RejectDto {
  /** 驳回原因（去空格后 ≥10 字，service 层再次校验） */
  @IsString()
  @MinLength(10, { message: '驳回原因不少于 10 个字' })
  comment!: string;
}

export class TransferDto {
  @IsString()
  comment!: string;

  /** 接收人用户 id */
  @IsString()
  toUserId!: string;
}

export class AddSignDto {
  /** 加签人用户 id */
  @IsString()
  signerId!: string;
}