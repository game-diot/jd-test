import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser, Roles } from '../auth/decorators.js';
import { AdminService } from './admin.service.js';
import { TerminateDto } from './dto/terminate.dto.js';

@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('contracts')
  contracts() {
    return this.admin.allContracts();
  }

  @Get('audit-logs')
  auditLogs(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.listAuditLogs(Number(page) || 1, Number(pageSize) || 20);
  }

  @Get('export-jobs')
  exportJobs() {
    return this.admin.listExportJobs();
  }

  @Post('contracts/:id/terminate')
  terminate(
    @Param('id') id: string,
    @Body() dto: TerminateDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.terminate(id, user.userId, dto);
  }
}