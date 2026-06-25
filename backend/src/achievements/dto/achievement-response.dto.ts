import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AchievementResponseDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() icon!: string;
  @ApiProperty() description!: string;
  @ApiProperty() xpReward!: number;
  @ApiProperty() category!: string;
  @ApiProperty() unlocked!: boolean;
  @ApiPropertyOptional({ nullable: true }) unlockedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) xpAwarded!: number | null;
}
