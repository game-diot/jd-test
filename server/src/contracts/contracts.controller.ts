import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../auth/decorators.js';
import { ContractsService } from './contracts.service.js';
import { CreateContractDto } from './dto/create-contract.dto.js';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private contracts: ContractsService) {}

  @Post()
  create(@Body() dto: CreateContractDto, @CurrentUser() user: JwtUser) {
    return this.contracts.create(user.userId, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtUser) {
    return this.contracts.findMine(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.findOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreateContractDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contracts.update(id, user.userId, dto);
  }
}