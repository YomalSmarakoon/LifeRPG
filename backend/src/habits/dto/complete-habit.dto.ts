import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteHabitDto {
  @ApiProperty({ description: 'Client-generated UUID v4 for idempotency' })
  @IsUUID('4') syncId!: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC timestamp; defaults to server now' })
  @IsOptional() @IsDateString() completedAt?: string;
}
