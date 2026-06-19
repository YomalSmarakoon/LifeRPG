import { ApiProperty } from '@nestjs/swagger';
import { XpEventResponseDto } from './xp-event-response.dto';

class StatsDto {
  @ApiProperty() STR!: number;
  @ApiProperty() INT!: number;
  @ApiProperty() WIS!: number;
  @ApiProperty() DEX!: number;
  @ApiProperty() CHA!: number;
  @ApiProperty() END!: number;
}

export class XpSummaryResponseDto {
  @ApiProperty() totalXp!: number;
  @ApiProperty() level!: number;
  @ApiProperty() currentLevelXp!: number;
  @ApiProperty() xpToNextLevel!: number;
  @ApiProperty() rank!: string;
  @ApiProperty() gold!: number;
  @ApiProperty({ type: StatsDto }) stats!: StatsDto;
  @ApiProperty({ type: [XpEventResponseDto] }) recentEvents!: XpEventResponseDto[];
}
