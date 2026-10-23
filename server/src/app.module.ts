import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { RequestIdMiddleware } from './common/request-id.middleware.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ContractsModule } from './contracts/contracts.module.js';
import { AdminModule } from './admin/admin.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
    FilesModule,
    ContractsModule,
    AdminModule,
    LedgerModule,
    ExportsModule,
    UsersModule,
  ],
  providers: [
    RequestIdMiddleware,
    // 全局守卫：限流 → JWT 认证（@Public 豁免）→ 角色校验（@Roles 生效）
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [],
})
export class AppModule {}