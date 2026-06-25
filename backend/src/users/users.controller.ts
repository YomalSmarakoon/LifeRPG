import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Safe user profile' })
  @ApiUnauthorizedResponse()
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const fullUser = await this.usersService.findById(user.userId);
    if (!fullUser) throw new NotFoundException('User not found');
    return this.usersService.toSafe(fullUser);
  }
}
