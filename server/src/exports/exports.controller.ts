import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser, Roles } from '../auth/decorators.js';
import { LedgerQueryDto } from '../ledger/dto/ledger-query.dto.js';
import { ExportsService } from './exports.service.js';

@ApiTags('exports')
@Controller('exports')
@Roles('admin', 'auditor')
export class ExportsController {
  constructor(private exports: ExportsService) {}

  @Post('contracts')
  create(@Body() dto: LedgerQueryDto, @CurrentUser() user: JwtUser) {
    return this.exports.createJob(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.exports.listJobs(user.userId);
  }

  @Get(':jobId')
  job(@Param('jobId') jobId: string, @CurrentUser() user: JwtUser) {
    return this.exports.getJob(jobId, user.userId);
  }

  @Get(':id/download-url')
  downloadUrl(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.exports.getDownloadUrl(id, user.userId);
  }
}