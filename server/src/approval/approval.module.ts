import { Module } from '@nestjs/common';
import { ApprovalRulesService } from './approval-rules.service.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalRulesService, ApprovalsService],
  exports: [ApprovalRulesService, ApprovalsService],
})
export class ApprovalModule {}