import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../auth/decorators.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  /** 转交对象：同部门 + 具备审批资格 + 有效账号（排除本人） */
  @Get('approvers')
  approvers(@CurrentUser() user: JwtUser) {
    return this.users.listApprovers(user.userId);
  }

  /** 加签对象：同级或上级 + 具备审批资格 + 有效账号（排除本人） */
  @Get('signers')
  signers(@CurrentUser() user: JwtUser) {
    return this.users.listSigners(user.userId);
  }
}