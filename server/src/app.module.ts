import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

/**
 * 根模块。
 * 阶段 3 起再按 PRD §9.3 逐模块接入：
 * Auth / Users / Organizations / Permissions / Contracts /
 * Files / Approvals / Ledger / Exports / Audit。
 */
@Module({
  imports: [HealthModule],
  providers: [RequestIdMiddleware],
  controllers: [],
})
export class AppModule {}