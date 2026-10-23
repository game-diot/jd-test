import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TerminateDto {
  @IsString()
  @IsNotEmpty({ message: '终止原因不能为空' })
  @MinLength(5, { message: '请填写充分的终止原因' })
  reason!: string;
}