import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Post('contracts/:id/terminate')
  terminate(
    @Param('id') id: string,
    @Body() dto: TerminateDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.admin.terminate(id, user.userId, dto);
  }
}