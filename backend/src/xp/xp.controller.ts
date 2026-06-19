import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiOkResponse,
  ApiBearerAuth, ApiUnauthorizedResponse, ApiQuery,
} from '@nestjs/swagger';
import { XpService } from './xp.service';
import { XpEventResponseDto } from './dto/xp-event-response.dto';
import { XpSummaryResponseDto } from './dto/xp-summary-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('xp')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('xp')
export class XpController {
  constructor(private readonly xpService: XpService) {}

  @Get('events')
  @ApiOperation({ summary: 'List XP events (newest first, cursor-paginated)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, description: 'ObjectId cursor for pagination' })
  @ApiQuery({ name: 'source', required: false, enum: ['habit_complete', 'habit_undo', 'achievement_unlock'] })
  @ApiOkResponse({ description: 'XP event list with next cursor' })
  @ApiUnauthorizedResponse()
  async listEvents(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('source') source?: string,
  ) {
    return this.xpService.listEvents(
      user.userId,
      limit ? parseInt(limit, 10) : 50,
      before,
      source,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'XP summary with current character state and recent events' })
  @ApiOkResponse({ type: XpSummaryResponseDto })
  @ApiUnauthorizedResponse()
  async getSummary(@CurrentUser() user: CurrentUserPayload): Promise<XpSummaryResponseDto> {
    return this.xpService.getSummary(user.userId);
  }
}
