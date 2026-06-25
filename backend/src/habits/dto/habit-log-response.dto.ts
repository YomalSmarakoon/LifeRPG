import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class HabitSnapshotDto {
  @ApiProperty() name!: string;
  @ApiProperty() xpReward!: number;
}

export class HabitLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() logType!: string;
  @ApiProperty() dateKey!: string;
  @ApiProperty() completedAt!: string;
  @ApiProperty() xpAwarded!: number;
  @ApiProperty() undone!: boolean;
  @ApiProperty({ type: HabitSnapshotDto }) habitSnapshot!: HabitSnapshotDto;
}
