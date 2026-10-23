import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../auth/decorators.js';
import { ApprovalsService } from './approvals.service.js';
import { AddSignDto, RejectDto, TransferDto } from './dto/approval.dto.js';

@ApiTags('approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}

  @Get('pending')
  pending(@CurrentUser() user: JwtUser) {
    return this.approvals.pending(user.userId);
  }

  @Get('processed')
  processed(@CurrentUser() user: JwtUser) {
    return this.approvals.processed(user.userId);
  }

  @Get(':taskId')
  detail(@Param('taskId') taskId: string, @CurrentUser() user: JwtUser) {
    return this.approvals.detail(taskId, user.userId);
  }

  @Post(':taskId/approve')
  approve(@Param('taskId') taskId: string, @CurrentUser() user: JwtUser) {
    return this.approvals.approve(taskId, user.userId);
  }

  @Post(':taskId/reject')
  reject(
    @Param('taskId') taskId: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.approvals.reject(taskId, user.userId, dto);
  }

  @Post(':taskId/transfer')
  transfer(
    @Param('taskId') taskId: string,
    @Body() dto: TransferDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.approvals.transfer(taskId, user.userId, dto);
  }

  @Post(':taskId/add-sign')
  addSign(
    @Param('taskId') taskId: string,
    @Body() dto: AddSignDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.approvals.addSign(taskId, user.userId, dto);
  }
}