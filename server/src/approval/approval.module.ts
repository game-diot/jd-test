import { Module } from '@nestjs/common';
import { ApprovalRulesService } from './approval-rules.service.js';

@Module({
  providers: [ApprovalRulesService],
  exports: [ApprovalRulesService],
})
export class ApprovalModule {}