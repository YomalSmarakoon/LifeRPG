import { ApiProperty } from '@nestjs/swagger';

class StreakStateDto {
  @ApiProperty() current!: number;
  @ApiProperty() shields!: number;
}

class CharacterStreaksDto {
  @ApiProperty({ type: StreakStateDto }) gym!: StreakStateDto;
  @ApiProperty({ type: StreakStateDto }) code!: StreakStateDto;
  @ApiProperty({ type: StreakStateDto }) reading!: StreakStateDto;
  @ApiProperty({ type: StreakStateDto }) earlyRise!: StreakStateDto;
}

class CharacterStatsDto {
  @ApiProperty() STR!: number;
  @ApiProperty() INT!: number;
  @ApiProperty() WIS!: number;
  @ApiProperty() DEX!: number;
  @ApiProperty() CHA!: number;
  @ApiProperty() END!: number;
}

export class CharacterResponseDto {
  @ApiProperty() level!: number;
  @ApiProperty() totalXp!: number;
  @ApiProperty() currentLevelXp!: number;
  @ApiProperty() xpToNextLevel!: number;
  @ApiProperty() rank!: string;
  @ApiProperty() gold!: number;
  @ApiProperty({ type: CharacterStatsDto }) stats!: CharacterStatsDto;
  @ApiProperty() avatarEmoji!: string;
  @ApiProperty() className!: string;
  @ApiProperty({ type: CharacterStreaksDto }) streaks!: CharacterStreaksDto;
}
