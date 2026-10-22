import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: '服务健康检查' })
  check() {
    return {
      status: 'ok',
      service: 'contract-seal-server',
      time: new Date().toISOString(),
    };
  }
}