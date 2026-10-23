import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators.js';
import { LedgerQueryDto } from './dto/ledger-query.dto.js';
import { LedgerService } from './ledger.service.js';

@ApiTags('ledger')
@Controller('ledger')
@Roles('admin', 'auditor')
export class LedgerController {
  constructor(private ledger: LedgerService) {}

  @Get('contracts')
  query(@Query() q: LedgerQueryDto) {
    return this.ledger.query(q);
  }

  @Get('contracts/:id')
  detail(@Param('id') id: string) {
    return this.ledger.detail(id);
  }
}