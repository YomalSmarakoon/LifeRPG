import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse,
  ApiNoContentResponse, ApiBearerAuth, ApiUnauthorizedResponse,
  ApiNotFoundResponse, ApiConflictResponse, ApiQuery,
} from '@nestjs/swagger';
import { HabitsService } from './habits.service';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { CompleteHabitDto } from './dto/complete-habit.dto';
import { UndoHabitDto } from './dto/undo-habit.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('habits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  @ApiOperation({ summary: 'List habits for current user' })
  @ApiQuery({ name: 'frequency', required: false, enum: ['daily', 'weekly'] })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiOkResponse({ description: 'Habit list with completion state' })
  @ApiUnauthorizedResponse()
  async listHabits(
    @CurrentUser() user: CurrentUserPayload,
    @Query('frequency') frequency?: string,
    @Query('active') active?: string,
  ) {
    const activeFilter = active !== undefined ? active === 'true' : undefined;
    return this.habitsService.listHabits(user.userId, frequency, activeFilter);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom habit' })
  @ApiCreatedResponse({ type: HabitResponseDto })
  @ApiUnauthorizedResponse()
  async createHabit(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateHabitDto,
  ) {
    return this.habitsService.createHabit(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single habit' })
  @ApiOkResponse({ type: HabitResponseDto })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async getHabit(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const habit = await this.habitsService.getHabit(id, user.userId);
    // toHabitResponse via service — re-use list logic for simplicity
    const result = await this.habitsService.listHabits(user.userId);
    const found = result.habits.find((h) => h.id === id);
    if (!found) return habit; // fallback (should never happen)
    return found;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mutable habit fields' })
  @ApiOkResponse({ type: HabitResponseDto })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async updateHabit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitsService.updateHabit(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete habit (sets isActive: false)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async deleteHabit(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.habitsService.deleteHabit(id, user.userId);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a daily habit' })
  @ApiOkResponse({ description: 'Completion result with XP and streak info' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Already completed today' })
  @ApiUnauthorizedResponse()
  async completeHabit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CompleteHabitDto,
  ) {
    return this.habitsService.completeHabit(user.userId, id, dto);
  }

  @Post(':id/undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo a daily habit completion (same day only)' })
  @ApiOkResponse({ description: 'Undo result with reverted XP' })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async undoHabit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UndoHabitDto,
  ) {
    return this.habitsService.undoHabit(user.userId, id, dto);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get completion logs for a habit' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Log list' })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async getHabitLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.habitsService.getHabitLogs(
      user.userId,
      id,
      from,
      to,
      limit ? parseInt(limit, 10) : 60,
    );
  }
}
