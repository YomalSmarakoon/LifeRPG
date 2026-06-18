import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'liferpg-api' },
        timestamp: { type: 'string', example: '2026-06-17T06:00:00.000Z' },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      service: 'liferpg-api',
      timestamp: new Date().toISOString(),
    };
  }
}
