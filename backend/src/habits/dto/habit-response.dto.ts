import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HabitResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() icon!: string;
  @ApiProperty() category!: string;
  @ApiProperty() frequency!: string;
  @ApiProperty() xpReward!: number;
  @ApiProperty() difficulty!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() sortOrder!: number;

  // Daily-only
  @ApiPropertyOptional() streakKey?: string | null;
  @ApiPropertyOptional() dateKey?: string;
  @ApiPropertyOptional() completedToday?: boolean;

  // Weekly-only
  @ApiPropertyOptional() weeklyTrackingMode?: string | null;
  @ApiPropertyOptional() weeklyTarget?: number | null;
  @ApiPropertyOptional() weeklyCategory?: string | null;
  @ApiPropertyOptional() weeklyHabitIds?: string[];
  @ApiPropertyOptional() weekKey?: string;
  @ApiPropertyOptional() progress?: number;
  @ApiPropertyOptional() completedThisWeek?: boolean;
}
