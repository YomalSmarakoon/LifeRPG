import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiOkResponse,
  ApiBearerAuth, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { AchievementResponseDto } from './dto/achievement-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('achievements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all achievement definitions with unlock status' })
  @ApiOkResponse({ type: [AchievementResponseDto] })
  @ApiUnauthorizedResponse()
  async getAchievements(@CurrentUser() user: CurrentUserPayload): Promise<AchievementResponseDto[]> {
    return this.achievementsService.findAllWithStatus(user.userId);
  }
}
