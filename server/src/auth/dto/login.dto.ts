import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** email 或 employee_no，二选一 */
  @IsString()
  account: string;

  @IsString()
  @MinLength(6)
  password: string;
}