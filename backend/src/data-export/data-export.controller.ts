import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DataExportService } from './data-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('data')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('data')
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Get('export')
  @ApiOperation({ summary: 'Export all user data as JSON' })
  @ApiOkResponse({ description: 'Full data export (no sensitive fields)' })
  @ApiUnauthorizedResponse()
  async exportData(@CurrentUser() user: CurrentUserPayload) {
    return this.dataExportService.exportData(user.userId);
  }
}
