import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module.js';
import { ContractsController } from './contracts.controller.js';
import { ContractsService } from './contracts.service.js';

@Module({
  imports: [ApprovalModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}